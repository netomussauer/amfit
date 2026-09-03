// Package infrastructure contém as implementações de repositório para o contexto Progress.
package infrastructure

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/amfit/api/internal/progress/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresRepositories agrega os repositorios PostgreSQL do contexto Progress.
type PostgresRepositories struct {
	Historico domain.HistoricoQueryRepository
	Dashboard domain.DashboardQueryRepository
	Access    domain.AccessRepository
	Anamnese  domain.AnamneseRepository
}

// NewPostgresRepositories cria os repositorios sobre o pool compartilhado.
func NewPostgresRepositories(pool *pgxpool.Pool) *PostgresRepositories {
	return &PostgresRepositories{
		Historico: &historicoRepo{pool: pool},
		Dashboard: &dashboardRepo{pool: pool},
		Access:    &accessRepo{pool: pool},
		Anamnese:  &anamneseRepo{pool: pool},
	}
}

// ─── Historico ─────────────────────────────────────────────────────────────

type historicoRepo struct {
	pool *pgxpool.Pool
}

// Subquery ordena DESC pra que o LIMIT descarte os pontos mais ANTIGOS
// (nao os mais recentes) quando o intervalo excede o limite — e o que o
// doc comment de HistoricoCarga sempre prometeu ("mais recentes primeiro
// quando excedido"), mas a query original ordenava ASC direto + LIMIT,
// entao um historico longo o suficiente cortava exatamente os pontos mais
// recentes em silencio. A query externa re-ordena ASC pro contrato de
// retorno (mais antigo → mais recente) continuar o mesmo pros callers
// existentes (grafico de evolucao).
//
// `s.iniciado_em` entra como desempate depois de `data_execucao`: essa
// coluna e DATE (sem hora), entao duas sessoes CONCLUIDAS do mesmo
// exercicio no mesmo dia calendario (ex: aluno fez o mesmo exercicio em
// dois treinos diferentes no mesmo dia) empatam e ficam em ordem
// indefinida sem esse desempate — o que quebraria silenciosamente
// CalcularSugestaoProgressao (achado em code-review), que assume que a
// ULTIMA sessao da lista e de fato a mais recente.
const queryHistoricoCarga = `
SELECT sessao_id, data_execucao, numero_serie, carga_realizada, repeticoes_realizadas
FROM (
    SELECT
        s.id              AS sessao_id,
        s.data_execucao   AS data_execucao,
        s.iniciado_em     AS iniciado_em,
        r.numero_serie    AS numero_serie,
        r.carga_realizada AS carga_realizada,
        r.repeticoes_realizadas AS repeticoes_realizadas
    FROM registro_serie r
    JOIN sessao_treino s ON s.id = r.sessao_id
    JOIN item_treino   i ON i.id = r.item_treino_id
    WHERE s.aluno_id     = $1
      AND i.exercicio_id = $2
      AND s.status       = 'CONCLUIDO'
      AND r.concluida    = TRUE
      AND s.data_execucao BETWEEN $3 AND $4
    ORDER BY s.data_execucao DESC, s.iniciado_em DESC, r.numero_serie DESC
    LIMIT $5
) mais_recentes
ORDER BY data_execucao ASC, iniciado_em ASC, numero_serie ASC;
`

func (r *historicoRepo) HistoricoCarga(
	ctx context.Context,
	alunoID uuid.UUID,
	exercicioID uuid.UUID,
	from time.Time,
	to time.Time,
	limit int,
) ([]domain.HistoricoCargaPonto, error) {
	rows, err := r.pool.Query(ctx, queryHistoricoCarga, alunoID, exercicioID, from, to, limit)
	if err != nil {
		return nil, fmt.Errorf("historico carga query: %w", err)
	}
	defer rows.Close()

	out := make([]domain.HistoricoCargaPonto, 0, 64)
	for rows.Next() {
		var p domain.HistoricoCargaPonto
		if err := rows.Scan(
			&p.SessaoID,
			&p.DataExecucao,
			&p.NumeroSerie,
			&p.CargaRealizada,
			&p.RepeticoesRealizadas,
		); err != nil {
			return nil, fmt.Errorf("historico carga scan: %w", err)
		}
		out = append(out, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("historico carga rows: %w", err)
	}
	return out, nil
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

type dashboardRepo struct {
	pool *pgxpool.Pool
}

// Uma unica query agrupa os 5 contadores via subqueries / FILTER —
// evita 5 roundtrips para o banco. Janelas de 7d/30d sao calculadas
// em UTC no servidor de aplicacao para coerencia com data_execucao.
const queryDashboardResumo = `
WITH
alunos_pessoal AS (
    SELECT id FROM aluno WHERE personal_id = $1 AND ativo = TRUE
),
fichas_pessoal AS (
    SELECT id, aluno_id FROM ficha_treino
    WHERE personal_id = $1 AND ativa = TRUE
),
sessoes_7d AS (
    SELECT s.aluno_id
    FROM sessao_treino s
    JOIN alunos_pessoal a ON a.id = s.aluno_id
    WHERE s.data_execucao >= $2::date
      AND s.status = 'CONCLUIDO'
),
sessoes_30d AS (
    SELECT s.aluno_id
    FROM sessao_treino s
    JOIN alunos_pessoal a ON a.id = s.aluno_id
    WHERE s.data_execucao >= $3::date
      AND s.status = 'CONCLUIDO'
)
SELECT
    (SELECT COUNT(*) FROM alunos_pessoal)                                     AS alunos_ativos,
    (SELECT COUNT(*) FROM fichas_pessoal)                                     AS fichas_ativas,
    (SELECT COUNT(*) FROM sessoes_7d)                                         AS sessoes_7d,
    (SELECT COUNT(*) FROM sessoes_30d)                                        AS sessoes_30d,
    (SELECT COUNT(*) FROM alunos_pessoal a
       WHERE NOT EXISTS (SELECT 1 FROM sessoes_7d s WHERE s.aluno_id = a.id)) AS alunos_sem_sessao_7d;
`

func (r *dashboardRepo) Resumo(
	ctx context.Context,
	personalID uuid.UUID,
) (domain.DashboardResumo, error) {
	now := time.Now().UTC()
	d7 := now.AddDate(0, 0, -7).Format("2006-01-02")
	d30 := now.AddDate(0, 0, -30).Format("2006-01-02")

	var out domain.DashboardResumo
	out.PersonalID = personalID

	err := r.pool.QueryRow(ctx, queryDashboardResumo, personalID, d7, d30).Scan(
		&out.AlunosAtivos,
		&out.FichasAtivas,
		&out.SessoesUltimos7Dias,
		&out.SessoesUltimos30Dias,
		&out.AlunosSemSessao7Dias,
	)
	if err != nil {
		return domain.DashboardResumo{}, fmt.Errorf("dashboard resumo: %w", err)
	}
	return out, nil
}

// ─── Access ────────────────────────────────────────────────────────────────

type accessRepo struct {
	pool *pgxpool.Pool
}

const queryAlunoPertencePersonal = `
SELECT 1 FROM aluno WHERE id = $1 AND personal_id = $2 AND ativo = TRUE;
`

func (r *accessRepo) AlunoExisteEPertenceAoPersonal(
	ctx context.Context,
	personalID, alunoID uuid.UUID,
) error {
	var x int
	err := r.pool.QueryRow(ctx, queryAlunoPertencePersonal, alunoID, personalID).Scan(&x)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrAlunoNotFound
		}
		return fmt.Errorf("aluno-personal check: %w", err)
	}
	return nil
}

// Visivel = global (personal_id IS NULL) OU pertence ao personal.
const queryExercicioVisivelPersonal = `
SELECT 1 FROM exercicio
WHERE id = $1
  AND ativo = TRUE
  AND (personal_id IS NULL OR personal_id = $2);
`

func (r *accessRepo) ExercicioVisivelParaPersonal(
	ctx context.Context,
	personalID, exercicioID uuid.UUID,
) error {
	var x int
	err := r.pool.QueryRow(ctx, queryExercicioVisivelPersonal, exercicioID, personalID).Scan(&x)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrExercicioNotFound
		}
		return fmt.Errorf("exercicio-personal check: %w", err)
	}
	return nil
}

// Para o aluno: o exercicio precisa ser global OU pertencer ao personal
// do proprio aluno.
const queryExercicioVisivelAluno = `
SELECT 1 FROM exercicio e
JOIN aluno a ON a.id = $1
WHERE e.id = $2
  AND e.ativo = TRUE
  AND (e.personal_id IS NULL OR e.personal_id = a.personal_id);
`

func (r *accessRepo) ExercicioVisivelParaAluno(
	ctx context.Context,
	alunoID, exercicioID uuid.UUID,
) error {
	var x int
	err := r.pool.QueryRow(ctx, queryExercicioVisivelAluno, alunoID, exercicioID).Scan(&x)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrExercicioNotFound
		}
		return fmt.Errorf("exercicio-aluno check: %w", err)
	}
	return nil
}

// ─── Anamnese ──────────────────────────────────────────────────────────────

type anamneseRepo struct {
	pool *pgxpool.Pool
}

// respostaJSON e o shape persistido em `respostas_json` — espelha
// exatamente o exemplo do SDD §20.2 (chave por pergunta, {opcao, pontos}).
type respostaJSON struct {
	Opcao  string `json:"opcao"`
	Pontos int    `json:"pontos"`
}

type respostasJSON struct {
	FrequenciaSemanal respostaJSON `json:"frequencia_semanal"`
	ExperienciaMeses  respostaJSON `json:"experiencia_meses"`
	Objetivo          respostaJSON `json:"objetivo"`
	Restricoes        respostaJSON `json:"restricoes"`
	Disponibilidade   respostaJSON `json:"disponibilidade"`
}

func respostasToJSON(r domain.RespostasAnamnese) respostasJSON {
	return respostasJSON{
		FrequenciaSemanal: respostaJSON{Opcao: r.FrequenciaSemanal.Opcao, Pontos: r.FrequenciaSemanal.Pontos},
		ExperienciaMeses:  respostaJSON{Opcao: r.ExperienciaMeses.Opcao, Pontos: r.ExperienciaMeses.Pontos},
		Objetivo:          respostaJSON{Opcao: r.Objetivo.Opcao, Pontos: r.Objetivo.Pontos},
		Restricoes:        respostaJSON{Opcao: r.Restricoes.Opcao, Pontos: r.Restricoes.Pontos},
		Disponibilidade:   respostaJSON{Opcao: r.Disponibilidade.Opcao, Pontos: r.Disponibilidade.Pontos},
	}
}

func respostasFromJSON(j respostasJSON) domain.RespostasAnamnese {
	return domain.RespostasAnamnese{
		FrequenciaSemanal: domain.RespostaAnamnese{Opcao: j.FrequenciaSemanal.Opcao, Pontos: j.FrequenciaSemanal.Pontos},
		ExperienciaMeses:  domain.RespostaAnamnese{Opcao: j.ExperienciaMeses.Opcao, Pontos: j.ExperienciaMeses.Pontos},
		Objetivo:          domain.RespostaAnamnese{Opcao: j.Objetivo.Opcao, Pontos: j.Objetivo.Pontos},
		Restricoes:        domain.RespostaAnamnese{Opcao: j.Restricoes.Opcao, Pontos: j.Restricoes.Pontos},
		Disponibilidade:   domain.RespostaAnamnese{Opcao: j.Disponibilidade.Opcao, Pontos: j.Disponibilidade.Pontos},
	}
}

// Upsert insere ou atualiza por aluno_id (UNIQUE). Em conflito, o id e
// preenchido_em originais sao preservados — so os dados e atualizado_em
// mudam, porque uma reavaliacao edita a MESMA anamnese, nao cria outra.
const queryUpsertAnamnese = `
INSERT INTO anamnese (
    aluno_id, objetivo, lesoes, doencas_preexistentes, medicamentos,
    pratica_outro_esporte, outro_esporte, frequencia_semanas_anterior,
    observacoes_gerais, respostas_json, score_calculado, nivel_sugerido
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (aluno_id) DO UPDATE SET
    objetivo                    = EXCLUDED.objetivo,
    lesoes                      = EXCLUDED.lesoes,
    doencas_preexistentes       = EXCLUDED.doencas_preexistentes,
    medicamentos                = EXCLUDED.medicamentos,
    pratica_outro_esporte       = EXCLUDED.pratica_outro_esporte,
    outro_esporte                = EXCLUDED.outro_esporte,
    frequencia_semanas_anterior = EXCLUDED.frequencia_semanas_anterior,
    observacoes_gerais           = EXCLUDED.observacoes_gerais,
    respostas_json                = EXCLUDED.respostas_json,
    score_calculado                = EXCLUDED.score_calculado,
    nivel_sugerido                  = EXCLUDED.nivel_sugerido,
    atualizado_em                    = NOW()
RETURNING id, preenchido_em, atualizado_em;
`

func (r *anamneseRepo) Upsert(ctx context.Context, a *domain.Anamnese) error {
	payload, err := json.Marshal(respostasToJSON(a.Respostas))
	if err != nil {
		return fmt.Errorf("marshal respostas_json: %w", err)
	}

	err = r.pool.QueryRow(ctx, queryUpsertAnamnese,
		a.AlunoID, a.Objetivo, a.Lesoes, a.DoencasPreexistentes, a.Medicamentos,
		a.PraticaOutroEsporte, a.OutroEsporte, a.FrequenciaSemanasAnterior,
		a.ObservacoesGerais, payload, a.ScoreCalculado, a.NivelSugerido,
	).Scan(&a.ID, &a.PreenchidoEm, &a.AtualizadoEm)
	if err != nil {
		return fmt.Errorf("upsert anamnese: %w", err)
	}
	return nil
}

const queryFindAnamnese = `
SELECT id, aluno_id, objetivo, lesoes, doencas_preexistentes, medicamentos,
       pratica_outro_esporte, outro_esporte, frequencia_semanas_anterior,
       observacoes_gerais, respostas_json, score_calculado, nivel_sugerido,
       preenchido_em, atualizado_em
FROM anamnese
WHERE aluno_id = $1;
`

func (r *anamneseRepo) FindByAlunoID(ctx context.Context, alunoID uuid.UUID) (*domain.Anamnese, error) {
	var a domain.Anamnese
	var payload []byte
	var nivel string

	err := r.pool.QueryRow(ctx, queryFindAnamnese, alunoID).Scan(
		&a.ID, &a.AlunoID, &a.Objetivo, &a.Lesoes, &a.DoencasPreexistentes, &a.Medicamentos,
		&a.PraticaOutroEsporte, &a.OutroEsporte, &a.FrequenciaSemanasAnterior,
		&a.ObservacoesGerais, &payload, &a.ScoreCalculado, &nivel,
		&a.PreenchidoEm, &a.AtualizadoEm,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrAnamneseNotFound
		}
		return nil, fmt.Errorf("find anamnese: %w", err)
	}
	a.NivelSugerido = domain.NivelAnamnese(nivel)

	var j respostasJSON
	if err := json.Unmarshal(payload, &j); err != nil {
		return nil, fmt.Errorf("unmarshal respostas_json: %w", err)
	}
	a.Respostas = respostasFromJSON(j)

	return &a, nil
}
