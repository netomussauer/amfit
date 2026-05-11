// Package infrastructure contém as implementações de repositório para o contexto Progress.
package infrastructure

import (
	"context"
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
}

// NewPostgresRepositories cria os repositorios sobre o pool compartilhado.
func NewPostgresRepositories(pool *pgxpool.Pool) *PostgresRepositories {
	return &PostgresRepositories{
		Historico: &historicoRepo{pool: pool},
		Dashboard: &dashboardRepo{pool: pool},
		Access:    &accessRepo{pool: pool},
	}
}

// ─── Historico ─────────────────────────────────────────────────────────────

type historicoRepo struct {
	pool *pgxpool.Pool
}

const queryHistoricoCarga = `
SELECT
    s.id              AS sessao_id,
    s.data_execucao   AS data_execucao,
    r.numero_serie    AS numero_serie,
    r.carga_realizada AS carga_realizada,
    r.repeticoes_realizadas AS repeticoes_realizadas
FROM registro_serie r
JOIN sessao_treino s ON s.id = r.sessao_id
JOIN item_treino   i ON i.id = r.item_treino_id
WHERE s.aluno_id     = $1
  AND i.exercicio_id = $2
  AND s.status       = 'CONCLUIDA'
  AND r.concluida    = TRUE
  AND s.data_execucao BETWEEN $3 AND $4
ORDER BY s.data_execucao ASC, r.numero_serie ASC
LIMIT $5;
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
      AND s.status = 'CONCLUIDA'
),
sessoes_30d AS (
    SELECT s.aluno_id
    FROM sessao_treino s
    JOIN alunos_pessoal a ON a.id = s.aluno_id
    WHERE s.data_execucao >= $3::date
      AND s.status = 'CONCLUIDA'
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
