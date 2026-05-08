// Package infrastructure contém as implementações de repositório para o contexto Execution.
package infrastructure

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/amfit/api/internal/execution/application"
	"github.com/amfit/api/internal/execution/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresRepositories agrega os repositórios PostgreSQL do contexto Execution.
type PostgresRepositories struct {
	pool *pgxpool.Pool

	Sessoes      domain.SessaoRepository
	Registros    domain.RegistroSerieRepository
	TreinoLookup domain.TreinoLookup
	AlunoLookup  application.AlunoLookup
}

// NewPostgresRepositories cria a instância com o pool compartilhado.
func NewPostgresRepositories(pool *pgxpool.Pool) *PostgresRepositories {
	return &PostgresRepositories{
		pool:         pool,
		Sessoes:      &sessaoRepo{pool: pool},
		Registros:    &registroRepo{pool: pool},
		TreinoLookup: &treinoLookup{pool: pool},
		AlunoLookup:  &alunoLookup{pool: pool},
	}
}

// ── SessaoRepository ───────────────────────────────────────────────────────

type sessaoRepo struct {
	pool *pgxpool.Pool
}

func (r *sessaoRepo) Create(ctx context.Context, s *domain.SessaoTreino) error {
	const q = `
		INSERT INTO sessao_treino (
			id, aluno_id, treino_id, data_execucao, status, iniciado_em, observacao
		) VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''))
		RETURNING iniciado_em`

	err := r.pool.QueryRow(ctx, q,
		s.ID, s.AlunoID, s.TreinoID, s.DataExecucao, string(s.Status), s.IniciadoEm, s.Observacao,
	).Scan(&s.IniciadoEm)
	if err != nil {
		return fmt.Errorf("infrastructure: insert sessão: %w", err)
	}
	return nil
}

func (r *sessaoRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.SessaoTreino, error) {
	const q = `
		SELECT id, aluno_id, treino_id, data_execucao, status,
		       iniciado_em, concluido_em, COALESCE(observacao, '')
		FROM sessao_treino
		WHERE id = $1`

	var s domain.SessaoTreino
	var status string
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&s.ID, &s.AlunoID, &s.TreinoID, &s.DataExecucao, &status,
		&s.IniciadoEm, &s.ConcluidoEm, &s.Observacao,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrSessaoNotFound
		}
		return nil, fmt.Errorf("infrastructure: find sessão: %w", err)
	}
	s.Status = domain.StatusSessao(status)
	return &s, nil
}

func (r *sessaoRepo) FindEmAndamentoHoje(
	ctx context.Context,
	alunoID, treinoID uuid.UUID,
) (*domain.SessaoTreino, error) {
	const q = `
		SELECT id, aluno_id, treino_id, data_execucao, status,
		       iniciado_em, concluido_em, COALESCE(observacao, '')
		FROM sessao_treino
		WHERE aluno_id = $1
		  AND treino_id = $2
		  AND data_execucao = CURRENT_DATE
		  AND status = 'EM_ANDAMENTO'
		ORDER BY iniciado_em DESC
		LIMIT 1`

	var s domain.SessaoTreino
	var status string
	err := r.pool.QueryRow(ctx, q, alunoID, treinoID).Scan(
		&s.ID, &s.AlunoID, &s.TreinoID, &s.DataExecucao, &status,
		&s.IniciadoEm, &s.ConcluidoEm, &s.Observacao,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrSessaoNotFound
		}
		return nil, fmt.Errorf("infrastructure: find sessão em andamento: %w", err)
	}
	s.Status = domain.StatusSessao(status)
	return &s, nil
}

// UpdateStatus aplica a mudança de status com proteção contra race em
// ConcluirSessao: o WHERE filtra por status='EM_ANDAMENTO'. Se outro processo
// concluir antes, RowsAffected=0 — recarregamos o estado e devolvemos nil
// quando já estiver no status alvo (idempotência); só erramos quando a
// sessão sumiu de fato (NotFound).
func (r *sessaoRepo) UpdateStatus(
	ctx context.Context,
	id uuid.UUID,
	status domain.StatusSessao,
	concluidoEm *time.Time,
) error {
	const q = `
		UPDATE sessao_treino
		   SET status = $2,
		       concluido_em = COALESCE($3, concluido_em)
		 WHERE id = $1
		   AND status = 'EM_ANDAMENTO'`

	tag, err := r.pool.Exec(ctx, q, id, string(status), concluidoEm)
	if err != nil {
		return fmt.Errorf("infrastructure: update status sessão: %w", err)
	}
	if tag.RowsAffected() == 0 {
		// Pode ser: (a) sessão não existe, (b) já estava no status alvo.
		// Releitura para distinguir e preservar a idempotência do caller.
		current, ferr := r.FindByID(ctx, id)
		if ferr != nil {
			return ferr
		}
		if current.Status == status {
			return nil
		}
		// Estado inesperado — ex.: tentar concluir uma já ABANDONADO.
		return domain.ErrSessaoJaConcluida
	}
	return nil
}

// ListByAluno usa subquery LATERAL para agregar os contadores de séries por
// sessão — uma única ida ao banco devolve sessão + treino + total/concluídas.
//
// Trade-off: a LATERAL adiciona um custo por linha retornada (a subquery
// roda 1x por sessão da página), mas o índice idx_registro_item_sessao
// e o LIMIT mantém isso barato para histórico paginado (per_page<=100).
// Alternativa seria pré-computar contadores em uma materialized view —
// adiada para quando o histórico crescer.
func (r *sessaoRepo) ListByAluno(
	ctx context.Context,
	alunoID uuid.UUID,
	page, perPage int,
) ([]*domain.SessaoComResumo, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	const listQ = `
		SELECT
			s.id, s.aluno_id, s.treino_id, s.data_execucao, s.status,
			s.iniciado_em, s.concluido_em, COALESCE(s.observacao, ''),
			t.letra, COALESCE(t.nome, ''),
			COALESCE(rs.total, 0), COALESCE(rs.concluidas, 0)
		FROM sessao_treino s
		JOIN treino t ON t.id = s.treino_id
		LEFT JOIN LATERAL (
			SELECT COUNT(*)::int AS total,
			       COUNT(*) FILTER (WHERE concluida)::int AS concluidas
			FROM registro_serie
			WHERE sessao_id = s.id
		) rs ON TRUE
		WHERE s.aluno_id = $1
		ORDER BY s.data_execucao DESC, s.iniciado_em DESC
		LIMIT $2 OFFSET $3`

	rows, err := r.pool.Query(ctx, listQ, alunoID, perPage, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("infrastructure: list sessões: %w", err)
	}
	defer rows.Close()

	out := make([]*domain.SessaoComResumo, 0, perPage)
	for rows.Next() {
		var item domain.SessaoComResumo
		var status string
		if err := rows.Scan(
			&item.ID, &item.AlunoID, &item.TreinoID, &item.DataExecucao, &status,
			&item.IniciadoEm, &item.ConcluidoEm, &item.Observacao,
			&item.TreinoLetra, &item.TreinoNome,
			&item.TotalSeries, &item.SeriesConcluidas,
		); err != nil {
			return nil, 0, fmt.Errorf("infrastructure: scan sessão: %w", err)
		}
		item.Status = domain.StatusSessao(status)
		out = append(out, &item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("infrastructure: iterate sessões: %w", err)
	}

	// Total para paginação — query separada, sem o JOIN com treino, usa o
	// índice idx_sessao_aluno_data e é barata.
	const countQ = `SELECT COUNT(*)::int FROM sessao_treino WHERE aluno_id = $1`
	var total int
	if err := r.pool.QueryRow(ctx, countQ, alunoID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("infrastructure: count sessões: %w", err)
	}

	return out, total, nil
}

// ── RegistroSerieRepository ────────────────────────────────────────────────

type registroRepo struct {
	pool *pgxpool.Pool
}

// Upsert: INSERT ... ON CONFLICT (sessao_id, item_treino_id, numero_serie)
// DO UPDATE. Garante idempotência das chamadas PATCH de RegistrarSerie:
// o cliente pode reenviar a mesma série múltiplas vezes (correção de carga,
// alternar concluida) sem violar constraint.
//
// RETURNING id devolve o ID já persistido — quando há conflito, o id mantido
// é o original (não o gerado no INSERT que sofreu UPDATE). Atualizamos o
// ponteiro do struct para refletir o id real.
func (r *registroRepo) Upsert(ctx context.Context, reg *domain.RegistroSerie) error {
	const q = `
		INSERT INTO registro_serie (
			id, sessao_id, item_treino_id, numero_serie,
			carga_realizada, repeticoes_realizadas, concluida, executado_em
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (sessao_id, item_treino_id, numero_serie)
		DO UPDATE SET
			carga_realizada       = EXCLUDED.carga_realizada,
			repeticoes_realizadas = EXCLUDED.repeticoes_realizadas,
			concluida             = EXCLUDED.concluida,
			executado_em          = EXCLUDED.executado_em
		RETURNING id`

	err := r.pool.QueryRow(ctx, q,
		reg.ID, reg.SessaoID, reg.ItemTreinoID, reg.NumeroSerie,
		reg.CargaRealizada, reg.RepeticoesRealizadas, reg.Concluida, reg.ExecutadoEm,
	).Scan(&reg.ID)
	if err != nil {
		return fmt.Errorf("infrastructure: upsert registro: %w", err)
	}
	return nil
}

func (r *registroRepo) ListBySessao(ctx context.Context, sessaoID uuid.UUID) ([]*domain.RegistroSerie, error) {
	const q = `
		SELECT id, sessao_id, item_treino_id, numero_serie,
		       carga_realizada, repeticoes_realizadas, concluida, executado_em
		FROM registro_serie
		WHERE sessao_id = $1
		ORDER BY item_treino_id, numero_serie`

	rows, err := r.pool.Query(ctx, q, sessaoID)
	if err != nil {
		return nil, fmt.Errorf("infrastructure: list registros: %w", err)
	}
	defer rows.Close()

	out := make([]*domain.RegistroSerie, 0)
	for rows.Next() {
		var reg domain.RegistroSerie
		if err := rows.Scan(
			&reg.ID, &reg.SessaoID, &reg.ItemTreinoID, &reg.NumeroSerie,
			&reg.CargaRealizada, &reg.RepeticoesRealizadas, &reg.Concluida, &reg.ExecutadoEm,
		); err != nil {
			return nil, fmt.Errorf("infrastructure: scan registro: %w", err)
		}
		out = append(out, &reg)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("infrastructure: iterate registros: %w", err)
	}
	return out, nil
}

func (r *registroRepo) CountBySessao(ctx context.Context, sessaoID uuid.UUID) (int, int, error) {
	const q = `
		SELECT
			COUNT(*) FILTER (WHERE concluida)::int,
			COUNT(*)::int
		FROM registro_serie
		WHERE sessao_id = $1`

	var concluidas, total int
	if err := r.pool.QueryRow(ctx, q, sessaoID).Scan(&concluidas, &total); err != nil {
		return 0, 0, fmt.Errorf("infrastructure: count registros: %w", err)
	}
	return concluidas, total, nil
}

// ── TreinoLookup (cross-context) ───────────────────────────────────────────

// treinoLookup faz queries diretas nas tabelas treino/item_treino/ficha_treino.
//
// Decisão: igual à estratégia adotada pelo Training (alunoLookup), preferimos
// query SQL direta em vez de importar training/domain em execution/. Mantém
// os bounded contexts desacoplados em código Go, ainda que haja acoplamento
// no nível do schema SQL (que é estável e versionado por migration).
type treinoLookup struct {
	pool *pgxpool.Pool
}

func (l *treinoLookup) GetTreinoComItens(
	ctx context.Context,
	treinoID uuid.UUID,
) (string, string, []domain.ItemBasico, error) {
	const treinoQ = `
		SELECT letra, COALESCE(nome, '')
		FROM treino
		WHERE id = $1`

	var letra, nome string
	if err := l.pool.QueryRow(ctx, treinoQ, treinoID).Scan(&letra, &nome); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", nil, domain.ErrTreinoInvalido
		}
		return "", "", nil, fmt.Errorf("infrastructure: get treino: %w", err)
	}

	const itensQ = `
		SELECT id, series
		FROM item_treino
		WHERE treino_id = $1
		ORDER BY ordem ASC`

	rows, err := l.pool.Query(ctx, itensQ, treinoID)
	if err != nil {
		return "", "", nil, fmt.Errorf("infrastructure: list itens lookup: %w", err)
	}
	defer rows.Close()

	itens := make([]domain.ItemBasico, 0)
	for rows.Next() {
		var it domain.ItemBasico
		if err := rows.Scan(&it.ID, &it.Series); err != nil {
			return "", "", nil, fmt.Errorf("infrastructure: scan item lookup: %w", err)
		}
		itens = append(itens, it)
	}
	if err := rows.Err(); err != nil {
		return "", "", nil, fmt.Errorf("infrastructure: iterate itens lookup: %w", err)
	}
	return letra, nome, itens, nil
}

func (l *treinoLookup) ValidarTreinoDoAluno(
	ctx context.Context,
	alunoID, treinoID uuid.UUID,
) (bool, error) {
	const q = `
		SELECT EXISTS (
			SELECT 1
			FROM treino t
			JOIN ficha_treino f ON f.id = t.ficha_id
			WHERE t.id = $1
			  AND f.aluno_id = $2
			  AND f.ativa = TRUE
			  AND f.vigencia_inicio <= CURRENT_DATE
			  AND (f.vigencia_fim IS NULL OR f.vigencia_fim >= CURRENT_DATE)
		)`

	var ok bool
	if err := l.pool.QueryRow(ctx, q, treinoID, alunoID).Scan(&ok); err != nil {
		return false, fmt.Errorf("infrastructure: validar treino aluno: %w", err)
	}
	return ok, nil
}

// ── AlunoLookup (cross-context) ────────────────────────────────────────────

// alunoLookup espelha exatamente o adapter usado por Training. Mantemos uma
// implementação local em vez de extrair para pkg/ porque cada contexto deve
// ser auto-contido — o custo de duplicar 10 linhas é menor que introduzir
// um pacote compartilhado que crie acoplamento entre contextos.
type alunoLookup struct {
	pool *pgxpool.Pool
}

func (l *alunoLookup) BelongsToPersonal(
	ctx context.Context,
	alunoID, personalID uuid.UUID,
) (bool, error) {
	const q = `
		SELECT EXISTS (
			SELECT 1 FROM aluno
			WHERE id = $1 AND personal_id = $2 AND ativo = TRUE
		)`

	var ok bool
	if err := l.pool.QueryRow(ctx, q, alunoID, personalID).Scan(&ok); err != nil {
		return false, fmt.Errorf("infrastructure: aluno lookup: %w", err)
	}
	return ok, nil
}
