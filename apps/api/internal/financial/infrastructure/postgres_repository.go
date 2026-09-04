// Package infrastructure contém as implementações de repositório para o
// contexto Financial.
package infrastructure

import (
	"context"
	"errors"
	"fmt"

	"github.com/amfit/api/internal/financial/application"
	"github.com/amfit/api/internal/financial/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// pgUniqueViolation é o SQLSTATE 23505 (unique_violation) — mesma constante
// usada em identity/training/infrastructure para traduzir uma corrida de
// concorrência (dois requests criando/reativando o plano ATIVO do mesmo
// aluno ao mesmo tempo) no erro de domínio correto em vez de um 500 cru.
const pgUniqueViolation = "23505"

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation
}

// PostgresRepositories agrega os repositórios PostgreSQL do contexto Financial.
type PostgresRepositories struct {
	Planos       domain.PlanoAlunoRepository
	Mensalidades domain.MensalidadeRepository
	AlunoLookup  application.AlunoLookup
}

// NewPostgresRepositories cria os repositórios sobre o pool compartilhado.
func NewPostgresRepositories(pool *pgxpool.Pool) *PostgresRepositories {
	return &PostgresRepositories{
		Planos:       &planoAlunoRepo{pool: pool},
		Mensalidades: &mensalidadeRepo{pool: pool},
		AlunoLookup:  &alunoLookup{pool: pool},
	}
}

// ─── PlanoAluno ──────────────────────────────────────────────────────────

type planoAlunoRepo struct {
	pool *pgxpool.Pool
}

func (r *planoAlunoRepo) Create(ctx context.Context, p *domain.PlanoAluno) error {
	const q = `
		INSERT INTO plano_aluno
			(id, aluno_id, personal_id, valor_mensal, dia_vencimento,
			 vigencia_inicio, status, observacao)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NULLIF($7, ''))
		RETURNING id, criado_em, atualizado_em`

	err := r.pool.QueryRow(ctx, q,
		p.AlunoID, p.PersonalID, p.ValorMensal, p.DiaVencimento,
		p.VigenciaInicio, string(p.Status), p.Observacao,
	).Scan(&p.ID, &p.CriadoEm, &p.AtualizadoEm)
	if err != nil {
		if isUniqueViolation(err) {
			return domain.ErrPlanoJaAtivo
		}
		return fmt.Errorf("infrastructure: criar plano_aluno: %w", err)
	}
	return nil
}

func (r *planoAlunoRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.PlanoAluno, error) {
	const q = `
		SELECT id, aluno_id, personal_id, valor_mensal, dia_vencimento,
		       vigencia_inicio, vigencia_fim, status, COALESCE(observacao, ''),
		       criado_em, atualizado_em
		FROM plano_aluno WHERE id = $1`

	p, err := scanPlanoAluno(r.pool.QueryRow(ctx, q, id))
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("infrastructure: buscar plano_aluno: %w", err)
	}
	return p, nil
}

func (r *planoAlunoRepo) FindAtivoByAluno(ctx context.Context, alunoID uuid.UUID) (*domain.PlanoAluno, error) {
	const q = `
		SELECT id, aluno_id, personal_id, valor_mensal, dia_vencimento,
		       vigencia_inicio, vigencia_fim, status, COALESCE(observacao, ''),
		       criado_em, atualizado_em
		FROM plano_aluno WHERE aluno_id = $1 AND status = 'ATIVO'`

	p, err := scanPlanoAluno(r.pool.QueryRow(ctx, q, alunoID))
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("infrastructure: buscar plano ativo: %w", err)
	}
	return p, nil
}

func (r *planoAlunoRepo) Update(ctx context.Context, p *domain.PlanoAluno) error {
	const q = `
		UPDATE plano_aluno
		   SET valor_mensal = $2, dia_vencimento = $3, vigencia_fim = $4,
		       status = $5, observacao = NULLIF($6, ''), atualizado_em = NOW()
		 WHERE id = $1
		RETURNING atualizado_em`

	err := r.pool.QueryRow(ctx, q,
		p.ID, p.ValorMensal, p.DiaVencimento, p.VigenciaFim, string(p.Status), p.Observacao,
	).Scan(&p.AtualizadoEm)
	if err != nil {
		if isUniqueViolation(err) {
			return domain.ErrPlanoJaAtivo
		}
		return fmt.Errorf("infrastructure: atualizar plano_aluno: %w", err)
	}
	return nil
}

func (r *planoAlunoRepo) ListarAtivosParaGeracao(ctx context.Context) ([]*domain.PlanoAluno, error) {
	const q = `
		SELECT id, aluno_id, personal_id, valor_mensal, dia_vencimento,
		       vigencia_inicio, vigencia_fim, status, COALESCE(observacao, ''),
		       criado_em, atualizado_em
		FROM plano_aluno
		WHERE status = 'ATIVO'
		  AND vigencia_inicio <= CURRENT_DATE
		  AND (vigencia_fim IS NULL OR vigencia_fim >= CURRENT_DATE)`

	rows, err := r.pool.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("infrastructure: listar planos ativos: %w", err)
	}
	defer rows.Close()

	out := make([]*domain.PlanoAluno, 0)
	for rows.Next() {
		p, err := scanPlanoAluno(rows)
		if err != nil {
			return nil, fmt.Errorf("infrastructure: scan plano_aluno: %w", err)
		}
		out = append(out, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("infrastructure: iterar planos ativos: %w", err)
	}
	return out, nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanPlanoAluno(row rowScanner) (*domain.PlanoAluno, error) {
	var p domain.PlanoAluno
	var status string
	if err := row.Scan(
		&p.ID, &p.AlunoID, &p.PersonalID, &p.ValorMensal, &p.DiaVencimento,
		&p.VigenciaInicio, &p.VigenciaFim, &status, &p.Observacao,
		&p.CriadoEm, &p.AtualizadoEm,
	); err != nil {
		return nil, err
	}
	p.Status = domain.StatusPlano(status)
	return &p, nil
}

// ─── Mensalidade ─────────────────────────────────────────────────────────

type mensalidadeRepo struct {
	pool *pgxpool.Pool
}

const mensalidadeColumns = `
	id, plano_id, aluno_id, competencia_ano, competencia_mes, data_vencimento,
	valor, status, valor_pago, data_pagamento, forma_pagamento,
	COALESCE(observacao, ''), lembrete_enviado, criado_em, atualizado_em`

func scanMensalidadeRow(row rowScanner) (*domain.Mensalidade, error) {
	var m domain.Mensalidade
	var status string
	var forma *string
	if err := row.Scan(
		&m.ID, &m.PlanoID, &m.AlunoID, &m.CompetenciaAno, &m.CompetenciaMes, &m.DataVencimento,
		&m.Valor, &status, &m.ValorPago, &m.DataPagamento, &forma,
		&m.Observacao, &m.LembreteEnviado, &m.CriadoEm, &m.AtualizadoEm,
	); err != nil {
		return nil, err
	}
	m.Status = domain.StatusMensalidade(status)
	if forma != nil {
		f := domain.FormaPagamento(*forma)
		m.FormaPagamento = &f
	}
	return &m, nil
}

func (r *mensalidadeRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.Mensalidade, error) {
	q := fmt.Sprintf(`SELECT %s FROM mensalidade WHERE id = $1`, mensalidadeColumns)

	m, err := scanMensalidadeRow(r.pool.QueryRow(ctx, q, id))
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("infrastructure: buscar mensalidade: %w", err)
	}
	return m, nil
}

func (r *mensalidadeRepo) Update(ctx context.Context, m *domain.Mensalidade) error {
	const q = `
		UPDATE mensalidade
		   SET status = $2, valor_pago = $3, data_pagamento = $4,
		       forma_pagamento = $5, observacao = NULLIF($6, ''), atualizado_em = NOW()
		 WHERE id = $1
		RETURNING atualizado_em`

	var forma *string
	if m.FormaPagamento != nil {
		f := string(*m.FormaPagamento)
		forma = &f
	}
	err := r.pool.QueryRow(ctx, q,
		m.ID, string(m.Status), m.ValorPago, m.DataPagamento, forma, m.Observacao,
	).Scan(&m.AtualizadoEm)
	if err != nil {
		return fmt.Errorf("infrastructure: atualizar mensalidade: %w", err)
	}
	return nil
}

func (r *mensalidadeRepo) ListByPersonal(
	ctx context.Context,
	personalID uuid.UUID,
	params domain.ListarMensalidadesParams,
) ([]*domain.Mensalidade, int, error) {
	status := statusFilterArg(params.Status)
	return r.list(ctx,
		`FROM mensalidade m
		 JOIN aluno a ON a.id = m.aluno_id
		 WHERE a.personal_id = $1
		   AND ($2::uuid IS NULL OR m.aluno_id = $2)
		   AND ($3::status_mensalidade IS NULL OR m.status = $3)
		   AND ($4::int IS NULL OR m.competencia_ano = $4)
		   AND ($5::int IS NULL OR m.competencia_mes = $5)`,
		[]any{personalID, params.AlunoID, status, params.CompetenciaAno, params.CompetenciaMes},
		params.Page, params.PerPage,
	)
}

func (r *mensalidadeRepo) ListByAluno(
	ctx context.Context,
	alunoID uuid.UUID,
	params domain.ListarMensalidadesParams,
) ([]*domain.Mensalidade, int, error) {
	status := statusFilterArg(params.Status)
	return r.list(ctx,
		`FROM mensalidade m
		 WHERE m.aluno_id = $1
		   AND ($2::status_mensalidade IS NULL OR m.status = $2)
		   AND ($3::int IS NULL OR m.competencia_ano = $3)
		   AND ($4::int IS NULL OR m.competencia_mes = $4)`,
		[]any{alunoID, status, params.CompetenciaAno, params.CompetenciaMes},
		params.Page, params.PerPage,
	)
}

func statusFilterArg(status *domain.StatusMensalidade) *string {
	if status == nil {
		return nil
	}
	s := string(*status)
	return &s
}

// list monta e executa a query paginada compartilhada por ListByPersonal e
// ListByAluno — cada caller monta seu próprio FROM/WHERE (com placeholders
// $1..$N já preenchidos em args); list só acrescenta COUNT(*), ORDER BY e a
// paginação (LIMIT/OFFSET nos dois placeholders seguintes).
func (r *mensalidadeRepo) list(
	ctx context.Context,
	fromWhere string,
	args []any,
	page, perPage int,
) ([]*domain.Mensalidade, int, error) {
	countQ := "SELECT COUNT(*) " + fromWhere
	var total int
	if err := r.pool.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("infrastructure: contar mensalidades: %w", err)
	}

	limitPos := len(args) + 1
	offsetPos := len(args) + 2
	q := fmt.Sprintf(`SELECT %s %s ORDER BY m.data_vencimento DESC LIMIT $%d OFFSET $%d`,
		mensalidadeColumns, fromWhere, limitPos, offsetPos)
	offset := (page - 1) * perPage
	rows, err := r.pool.Query(ctx, q, append(append([]any{}, args...), perPage, offset)...)
	if err != nil {
		return nil, 0, fmt.Errorf("infrastructure: listar mensalidades: %w", err)
	}
	defer rows.Close()

	out := make([]*domain.Mensalidade, 0)
	for rows.Next() {
		m, err := scanMensalidadeRow(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("infrastructure: scan mensalidade: %w", err)
		}
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("infrastructure: iterar mensalidades: %w", err)
	}
	return out, total, nil
}

func (r *mensalidadeRepo) Dashboard(ctx context.Context, personalID uuid.UUID) (*domain.DashboardFinanceiro, error) {
	const resumoQ = `
		SELECT
			COALESCE(COUNT(*) FILTER (WHERE m.status = 'PENDENTE'), 0),
			COALESCE(SUM(m.valor) FILTER (WHERE m.status = 'PENDENTE'), 0),
			COALESCE(COUNT(*) FILTER (WHERE m.status = 'ATRASADA'), 0),
			COALESCE(SUM(m.valor) FILTER (WHERE m.status = 'ATRASADA'), 0),
			COALESCE(SUM(m.valor_pago) FILTER (
				WHERE m.status = 'PAGA'
				  AND m.competencia_ano = EXTRACT(YEAR FROM CURRENT_DATE)::int
				  AND m.competencia_mes = EXTRACT(MONTH FROM CURRENT_DATE)::int
			), 0)
		FROM mensalidade m
		JOIN aluno a ON a.id = m.aluno_id
		WHERE a.personal_id = $1`

	var d domain.DashboardFinanceiro
	if err := r.pool.QueryRow(ctx, resumoQ, personalID).Scan(
		&d.PendentesQtd, &d.PendentesValor, &d.AtrasadasQtd, &d.AtrasadasValor, &d.ReceitaMesAtual,
	); err != nil {
		return nil, fmt.Errorf("infrastructure: dashboard resumo: %w", err)
	}

	const inadimplentesQ = `
		SELECT a.id, a.nome, COUNT(*), SUM(m.valor)
		FROM mensalidade m
		JOIN aluno a ON a.id = m.aluno_id
		WHERE a.personal_id = $1 AND m.status = 'ATRASADA'
		GROUP BY a.id, a.nome
		ORDER BY SUM(m.valor) DESC`

	rows, err := r.pool.Query(ctx, inadimplentesQ, personalID)
	if err != nil {
		return nil, fmt.Errorf("infrastructure: dashboard inadimplentes: %w", err)
	}
	defer rows.Close()

	d.Inadimplentes = make([]domain.AlunoInadimplente, 0)
	for rows.Next() {
		var a domain.AlunoInadimplente
		if err := rows.Scan(&a.AlunoID, &a.Nome, &a.QtdAtrasadas, &a.ValorTotalAtrasado); err != nil {
			return nil, fmt.Errorf("infrastructure: scan inadimplente: %w", err)
		}
		d.Inadimplentes = append(d.Inadimplentes, a)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("infrastructure: iterar inadimplentes: %w", err)
	}
	return &d, nil
}

// GerarPendentes insere, de forma idempotente e atômica, a mensalidade da
// competência corrente para cada plano ATIVO com vigência corrente que
// ainda não tem uma — ver comentário na migration 000010 sobre a adaptação
// do job 1 do SDD (que roda no dia 1 via pg_cron) para um worker Go com
// polling: aqui não importa QUANDO no mês o worker roda, só que rode pelo
// menos uma vez durante o mês corrente.
func (r *mensalidadeRepo) GerarPendentes(ctx context.Context) (int, error) {
	const q = `
		WITH inseridas AS (
			INSERT INTO mensalidade
				(id, plano_id, aluno_id, competencia_ano, competencia_mes,
				 data_vencimento, valor, status)
			SELECT
				gen_random_uuid(),
				p.id,
				p.aluno_id,
				EXTRACT(YEAR FROM CURRENT_DATE)::int,
				EXTRACT(MONTH FROM CURRENT_DATE)::int,
				DATE_TRUNC('month', CURRENT_DATE)::date + (p.dia_vencimento - 1) * INTERVAL '1 day',
				p.valor_mensal,
				'PENDENTE'
			FROM plano_aluno p
			WHERE p.status = 'ATIVO'
			  AND p.vigencia_inicio <= CURRENT_DATE
			  AND (p.vigencia_fim IS NULL OR p.vigencia_fim >= CURRENT_DATE)
			  AND NOT EXISTS (
				  SELECT 1 FROM mensalidade m
				  WHERE m.plano_id = p.id
				    AND m.competencia_ano = EXTRACT(YEAR FROM CURRENT_DATE)::int
				    AND m.competencia_mes = EXTRACT(MONTH FROM CURRENT_DATE)::int
			  )
			RETURNING 1
		)
		SELECT COUNT(*) FROM inseridas`

	var n int
	if err := r.pool.QueryRow(ctx, q).Scan(&n); err != nil {
		return 0, fmt.Errorf("infrastructure: gerar mensalidades pendentes: %w", err)
	}
	return n, nil
}

func (r *mensalidadeRepo) MarcarAtrasadas(ctx context.Context) (int, error) {
	const q = `
		UPDATE mensalidade
		   SET status = 'ATRASADA', atualizado_em = NOW()
		 WHERE status = 'PENDENTE' AND data_vencimento < CURRENT_DATE`

	tag, err := r.pool.Exec(ctx, q)
	if err != nil {
		return 0, fmt.Errorf("infrastructure: marcar mensalidades atrasadas: %w", err)
	}
	return int(tag.RowsAffected()), nil
}

func (r *mensalidadeRepo) ListarParaLembrete(ctx context.Context, limit int) ([]*domain.Mensalidade, error) {
	q := fmt.Sprintf(`
		SELECT %s
		FROM mensalidade m
		WHERE m.status = 'PENDENTE'
		  AND m.lembrete_enviado = FALSE
		  AND m.data_vencimento <= CURRENT_DATE + INTERVAL '3 day'
		ORDER BY m.data_vencimento ASC
		LIMIT $1`, mensalidadeColumns)

	rows, err := r.pool.Query(ctx, q, limit)
	if err != nil {
		return nil, fmt.Errorf("infrastructure: listar mensalidades para lembrete: %w", err)
	}
	defer rows.Close()

	out := make([]*domain.Mensalidade, 0)
	for rows.Next() {
		m, err := scanMensalidadeRow(rows)
		if err != nil {
			return nil, fmt.Errorf("infrastructure: scan mensalidade lembrete: %w", err)
		}
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("infrastructure: iterar mensalidades para lembrete: %w", err)
	}
	return out, nil
}

func (r *mensalidadeRepo) MarcarLembreteEnviado(ctx context.Context, id uuid.UUID) error {
	const q = `UPDATE mensalidade SET lembrete_enviado = TRUE WHERE id = $1`
	if _, err := r.pool.Exec(ctx, q, id); err != nil {
		return fmt.Errorf("infrastructure: marcar lembrete enviado: %w", err)
	}
	return nil
}

// ─── AlunoLookup ─────────────────────────────────────────────────────────

type alunoLookup struct {
	pool *pgxpool.Pool
}

func (l *alunoLookup) BelongsToPersonal(ctx context.Context, alunoID, personalID uuid.UUID) (bool, error) {
	const q = `SELECT EXISTS (SELECT 1 FROM aluno WHERE id = $1 AND personal_id = $2)`

	var ok bool
	if err := l.pool.QueryRow(ctx, q, alunoID, personalID).Scan(&ok); err != nil {
		return false, fmt.Errorf("infrastructure: aluno lookup: %w", err)
	}
	return ok, nil
}
