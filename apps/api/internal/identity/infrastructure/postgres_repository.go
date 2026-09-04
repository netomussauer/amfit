// Package infrastructure contém as implementações de repositório para o contexto Identity.
package infrastructure

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/amfit/api/internal/identity/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// pgUniqueViolation é o SQLSTATE 23505 (unique_violation).
const pgUniqueViolation = "23505"

// PostgresRepositories agrega os repositórios PostgreSQL do contexto Identity.
type PostgresRepositories struct {
	pool *pgxpool.Pool

	Personal      domain.PersonalTrainerRepository
	Aluno         domain.AlunoRepository
	Credencial    domain.CredencialRepository
	RefreshTokens domain.RefreshTokenRepository
	TenantConfig  domain.TenantConfigRepository
}

// NewPostgresRepositories cria a instância com o pool compartilhado e expõe os repositórios.
func NewPostgresRepositories(pool *pgxpool.Pool) *PostgresRepositories {
	return &PostgresRepositories{
		pool:          pool,
		Personal:      &personalRepo{pool: pool},
		Aluno:         &alunoRepo{pool: pool},
		Credencial:    &credencialRepo{pool: pool},
		RefreshTokens: &refreshTokenRepo{pool: pool},
		TenantConfig:  &tenantConfigRepo{pool: pool},
	}
}

// ── PersonalTrainer ────────────────────────────────────────────────────────

type personalRepo struct {
	pool *pgxpool.Pool
}

func (r *personalRepo) Create(ctx context.Context, pt *domain.PersonalTrainer) error {
	const q = `
		INSERT INTO personal_trainer (id, nome, email, telefone, cref, ativo)
		VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), $6)
		RETURNING criado_em, atualizado_em`

	err := r.pool.QueryRow(ctx, q,
		pt.ID, pt.Nome, pt.Email, pt.Telefone, pt.CREF, pt.Ativo,
	).Scan(&pt.CriadoEm, &pt.AtualizadoEm)

	if err != nil {
		if isUniqueViolation(err) {
			return domain.ErrEmailAlreadyExists
		}
		return fmt.Errorf("infrastructure: insert personal: %w", err)
	}
	return nil
}

func (r *personalRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.PersonalTrainer, error) {
	const q = `
		SELECT id, nome, email, COALESCE(telefone, ''), COALESCE(cref, ''),
		       ativo, criado_em, atualizado_em
		FROM personal_trainer
		WHERE id = $1`

	var pt domain.PersonalTrainer
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&pt.ID, &pt.Nome, &pt.Email, &pt.Telefone, &pt.CREF,
		&pt.Ativo, &pt.CriadoEm, &pt.AtualizadoEm,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrPersonalNotFound
		}
		return nil, fmt.Errorf("infrastructure: find personal by id: %w", err)
	}
	return &pt, nil
}

func (r *personalRepo) FindByEmail(ctx context.Context, email string) (*domain.PersonalTrainer, error) {
	const q = `
		SELECT id, nome, email, COALESCE(telefone, ''), COALESCE(cref, ''),
		       ativo, criado_em, atualizado_em
		FROM personal_trainer
		WHERE email = $1`

	var pt domain.PersonalTrainer
	err := r.pool.QueryRow(ctx, q, email).Scan(
		&pt.ID, &pt.Nome, &pt.Email, &pt.Telefone, &pt.CREF,
		&pt.Ativo, &pt.CriadoEm, &pt.AtualizadoEm,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrPersonalNotFound
		}
		return nil, fmt.Errorf("infrastructure: find personal by email: %w", err)
	}
	return &pt, nil
}

func (r *personalRepo) Update(ctx context.Context, pt *domain.PersonalTrainer) error {
	const q = `
		UPDATE personal_trainer
		   SET nome = $2,
		       email = $3,
		       telefone = NULLIF($4, ''),
		       cref = NULLIF($5, ''),
		       ativo = $6,
		       atualizado_em = NOW()
		 WHERE id = $1
		 RETURNING atualizado_em`

	err := r.pool.QueryRow(ctx, q, pt.ID, pt.Nome, pt.Email, pt.Telefone, pt.CREF, pt.Ativo).
		Scan(&pt.AtualizadoEm)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrPersonalNotFound
		}
		if isUniqueViolation(err) {
			return domain.ErrEmailAlreadyExists
		}
		return fmt.Errorf("infrastructure: update personal: %w", err)
	}
	return nil
}

// ── Aluno ──────────────────────────────────────────────────────────────────

type alunoRepo struct {
	pool *pgxpool.Pool
}

func (r *alunoRepo) Create(ctx context.Context, a *domain.Aluno) error {
	const q = `
		INSERT INTO aluno (id, personal_id, nome, email, data_nascimento, sexo, telefone, ativo)
		VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), $8)
		RETURNING criado_em, atualizado_em`

	var sexo any
	if a.Sexo != nil {
		sexo = string(*a.Sexo)
	}
	var dn any
	if a.DataNascimento != nil {
		dn = *a.DataNascimento
	}

	err := r.pool.QueryRow(ctx, q,
		a.ID, a.PersonalID, a.Nome, a.Email, dn, sexo, a.Telefone, a.Ativo,
	).Scan(&a.CriadoEm, &a.AtualizadoEm)

	if err != nil {
		if isUniqueViolation(err) {
			return domain.ErrEmailAlreadyExists
		}
		return fmt.Errorf("infrastructure: insert aluno: %w", err)
	}
	return nil
}

func (r *alunoRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.Aluno, error) {
	const q = `
		SELECT id, personal_id, nome, email, data_nascimento, sexo,
		       COALESCE(telefone, ''), ativo, criado_em, atualizado_em
		FROM aluno
		WHERE id = $1`

	return scanAluno(r.pool.QueryRow(ctx, q, id))
}

func (r *alunoRepo) FindByEmail(ctx context.Context, email string) (*domain.Aluno, error) {
	const q = `
		SELECT id, personal_id, nome, email, data_nascimento, sexo,
		       COALESCE(telefone, ''), ativo, criado_em, atualizado_em
		FROM aluno
		WHERE email = $1`

	return scanAluno(r.pool.QueryRow(ctx, q, email))
}

func (r *alunoRepo) ListByPersonal(
	ctx context.Context,
	personalID uuid.UUID,
	filter domain.AlunoFilter,
) ([]*domain.Aluno, int, error) {
	page := filter.Page
	if page < 1 {
		page = 1
	}
	perPage := filter.PerPage
	if perPage < 1 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	// Conta o total respeitando o filtro de ativo.
	countQ := `SELECT COUNT(*) FROM aluno WHERE personal_id = $1`
	listQ := `
		SELECT id, personal_id, nome, email, data_nascimento, sexo,
		       COALESCE(telefone, ''), ativo, criado_em, atualizado_em
		FROM aluno
		WHERE personal_id = $1`

	args := []any{personalID}

	if filter.Ativo != nil {
		countQ += ` AND ativo = $2`
		listQ += ` AND ativo = $2`
		args = append(args, *filter.Ativo)
	}

	listQ += fmt.Sprintf(` ORDER BY nome ASC LIMIT $%d OFFSET $%d`, len(args)+1, len(args)+2)
	listArgs := append(append([]any{}, args...), perPage, offset)

	var total int
	if err := r.pool.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("infrastructure: count alunos: %w", err)
	}

	rows, err := r.pool.Query(ctx, listQ, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("infrastructure: list alunos: %w", err)
	}
	defer rows.Close()

	out := make([]*domain.Aluno, 0)
	for rows.Next() {
		a, err := scanAluno(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, a)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("infrastructure: iterate alunos: %w", err)
	}

	return out, total, nil
}

func (r *alunoRepo) Update(ctx context.Context, a *domain.Aluno) error {
	const q = `
		UPDATE aluno
		   SET nome = $2,
		       email = $3,
		       data_nascimento = $4,
		       sexo = $5,
		       telefone = NULLIF($6, ''),
		       atualizado_em = NOW()
		 WHERE id = $1
		 RETURNING atualizado_em`

	var sexo any
	if a.Sexo != nil {
		sexo = string(*a.Sexo)
	}
	var dn any
	if a.DataNascimento != nil {
		dn = *a.DataNascimento
	}

	err := r.pool.QueryRow(ctx, q, a.ID, a.Nome, a.Email, dn, sexo, a.Telefone).
		Scan(&a.AtualizadoEm)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrAlunoNotFound
		}
		if isUniqueViolation(err) {
			return domain.ErrEmailAlreadyExists
		}
		return fmt.Errorf("infrastructure: update aluno: %w", err)
	}
	return nil
}

func (r *alunoRepo) Deactivate(ctx context.Context, id uuid.UUID) error {
	const q = `
		UPDATE aluno
		   SET ativo = FALSE, atualizado_em = NOW()
		 WHERE id = $1`

	tag, err := r.pool.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("infrastructure: deactivate aluno: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrAlunoNotFound
	}
	return nil
}

// scanAluno aceita pgx.Row ou pgx.Rows.
type rowScanner interface {
	Scan(dest ...any) error
}

func scanAluno(row rowScanner) (*domain.Aluno, error) {
	var (
		a       domain.Aluno
		dn      *time.Time
		sexoStr *string
	)
	err := row.Scan(
		&a.ID, &a.PersonalID, &a.Nome, &a.Email,
		&dn, &sexoStr, &a.Telefone, &a.Ativo, &a.CriadoEm, &a.AtualizadoEm,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrAlunoNotFound
		}
		return nil, fmt.Errorf("infrastructure: scan aluno: %w", err)
	}
	a.DataNascimento = dn
	if sexoStr != nil {
		sx := domain.Sexo(*sexoStr)
		a.Sexo = &sx
	}
	return &a, nil
}

// ── Credencial ─────────────────────────────────────────────────────────────

type credencialRepo struct {
	pool *pgxpool.Pool
}

func (r *credencialRepo) Create(ctx context.Context, c *domain.Credencial) error {
	const q = `
		INSERT INTO credencial (id, owner_id, owner_type, password_hash)
		VALUES ($1, $2, $3, $4)`

	if _, err := r.pool.Exec(ctx, q, c.ID, c.OwnerID, string(c.OwnerType), c.PasswordHash); err != nil {
		return fmt.Errorf("infrastructure: insert credencial: %w", err)
	}
	return nil
}

func (r *credencialRepo) FindByOwner(
	ctx context.Context,
	ownerID uuid.UUID,
	ownerType domain.OwnerType,
) (*domain.Credencial, error) {
	const q = `
		SELECT id, owner_id, owner_type, password_hash, ultimo_acesso
		FROM credencial
		WHERE owner_id = $1 AND owner_type = $2`

	var (
		c        domain.Credencial
		typeStr  string
		ultimo   *time.Time
	)
	err := r.pool.QueryRow(ctx, q, ownerID, string(ownerType)).Scan(
		&c.ID, &c.OwnerID, &typeStr, &c.PasswordHash, &ultimo,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrInvalidCredentials
		}
		return nil, fmt.Errorf("infrastructure: find credencial: %w", err)
	}
	c.OwnerType = domain.OwnerType(typeStr)
	c.UltimoAcesso = ultimo
	return &c, nil
}

func (r *credencialRepo) UpdatePasswordHash(ctx context.Context, id uuid.UUID, hash string) error {
	const q = `UPDATE credencial SET password_hash = $2 WHERE id = $1`

	tag, err := r.pool.Exec(ctx, q, id, hash)
	if err != nil {
		return fmt.Errorf("infrastructure: update password_hash: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("infrastructure: update password_hash: credencial não encontrada")
	}
	return nil
}

func (r *credencialRepo) UpdateUltimoAcesso(ctx context.Context, id uuid.UUID) error {
	const q = `UPDATE credencial SET ultimo_acesso = NOW() WHERE id = $1`
	if _, err := r.pool.Exec(ctx, q, id); err != nil {
		return fmt.Errorf("infrastructure: update ultimo_acesso: %w", err)
	}
	return nil
}

// ── RefreshToken ───────────────────────────────────────────────────────────

type refreshTokenRepo struct {
	pool *pgxpool.Pool
}

func (r *refreshTokenRepo) Create(ctx context.Context, rt *domain.RefreshToken) error {
	const q = `
		INSERT INTO refresh_token (id, owner_id, jti, expira_em, revogado)
		VALUES ($1, $2, $3, $4, FALSE)
		RETURNING criado_em`

	err := r.pool.QueryRow(ctx, q, rt.ID, rt.OwnerID, rt.JTI, rt.ExpiraEm).Scan(&rt.CriadoEm)
	if err != nil {
		return fmt.Errorf("infrastructure: insert refresh_token: %w", err)
	}
	return nil
}

func (r *refreshTokenRepo) FindByJTI(ctx context.Context, jti string) (*domain.RefreshToken, error) {
	const q = `
		SELECT id, owner_id, jti, expira_em, revogado, criado_em
		FROM refresh_token
		WHERE jti = $1`

	var rt domain.RefreshToken
	err := r.pool.QueryRow(ctx, q, jti).Scan(
		&rt.ID, &rt.OwnerID, &rt.JTI, &rt.ExpiraEm, &rt.Revogado, &rt.CriadoEm,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrInvalidRefreshToken
		}
		return nil, fmt.Errorf("infrastructure: find refresh_token: %w", err)
	}
	return &rt, nil
}

func (r *refreshTokenRepo) RevokeByJTI(ctx context.Context, jti string) error {
	const q = `UPDATE refresh_token SET revogado = TRUE WHERE jti = $1`
	tag, err := r.pool.Exec(ctx, q, jti)
	if err != nil {
		return fmt.Errorf("infrastructure: revoke refresh_token: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrInvalidRefreshToken
	}
	return nil
}

func (r *refreshTokenRepo) RevokeAllByOwner(ctx context.Context, ownerID uuid.UUID) error {
	const q = `UPDATE refresh_token SET revogado = TRUE WHERE owner_id = $1 AND revogado = FALSE`
	if _, err := r.pool.Exec(ctx, q, ownerID); err != nil {
		return fmt.Errorf("infrastructure: revoke all refresh_tokens: %w", err)
	}
	return nil
}

// ── Helpers ────────────────────────────────────────────────────────────────

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == pgUniqueViolation
	}
	return false
}

// ── TenantConfig ───────────────────────────────────────────────────────────

type tenantConfigRepo struct {
	pool *pgxpool.Pool
}

const queryFindTenantConfig = `
SELECT personal_id, COALESCE(logo_url, ''), cor_primaria, cor_secundaria,
       COALESCE(nome_app, ''), atualizado_em
FROM tenant_config
WHERE personal_id = $1;
`

func (r *tenantConfigRepo) FindByPersonalID(
	ctx context.Context,
	personalID uuid.UUID,
) (*domain.TenantConfig, error) {
	var cfg domain.TenantConfig
	err := r.pool.QueryRow(ctx, queryFindTenantConfig, personalID).Scan(
		&cfg.PersonalID, &cfg.LogoURL, &cfg.CorPrimaria, &cfg.CorSecundaria,
		&cfg.NomeApp, &cfg.AtualizadoEm,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Não é um erro — "sem config ainda" é um estado normal (ver
			// doc do TenantConfigRepository).
			return nil, nil
		}
		return nil, fmt.Errorf("find tenant config: %w", err)
	}
	return &cfg, nil
}

const queryUpsertTenantConfig = `
INSERT INTO tenant_config (personal_id, logo_url, cor_primaria, cor_secundaria, nome_app)
VALUES ($1, NULLIF($2, ''), $3, $4, NULLIF($5, ''))
ON CONFLICT (personal_id) DO UPDATE SET
    logo_url       = NULLIF(EXCLUDED.logo_url, ''),
    cor_primaria   = EXCLUDED.cor_primaria,
    cor_secundaria = EXCLUDED.cor_secundaria,
    nome_app       = NULLIF(EXCLUDED.nome_app, ''),
    atualizado_em  = NOW()
RETURNING atualizado_em;
`

func (r *tenantConfigRepo) Upsert(ctx context.Context, cfg *domain.TenantConfig) error {
	err := r.pool.QueryRow(ctx, queryUpsertTenantConfig,
		cfg.PersonalID, cfg.LogoURL, cfg.CorPrimaria, cfg.CorSecundaria, cfg.NomeApp,
	).Scan(&cfg.AtualizadoEm)
	if err != nil {
		return fmt.Errorf("upsert tenant config: %w", err)
	}
	return nil
}
