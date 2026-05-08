// Package infrastructure contém as implementações de repositório para o contexto Catalog.
package infrastructure

import (
	"context"
	"errors"
	"fmt"

	"github.com/amfit/api/internal/catalog/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresRepositories agrega os repositórios PostgreSQL do contexto Catalog.
type PostgresRepositories struct {
	pool *pgxpool.Pool

	GruposMusculares domain.GrupoMuscularRepository
	Exercicios       domain.ExercicioRepository
}

// NewPostgresRepositories cria a instância com o pool compartilhado e expõe
// os repositórios prontos para uso.
func NewPostgresRepositories(pool *pgxpool.Pool) *PostgresRepositories {
	return &PostgresRepositories{
		pool:             pool,
		GruposMusculares: &grupoMuscularRepo{pool: pool},
		Exercicios:       &exercicioRepo{pool: pool},
	}
}

// ── GrupoMuscular ──────────────────────────────────────────────────────────

type grupoMuscularRepo struct {
	pool *pgxpool.Pool
}

func (r *grupoMuscularRepo) ListAll(ctx context.Context) ([]*domain.GrupoMuscular, error) {
	const q = `
		SELECT id, nome, COALESCE(descricao, '')
		FROM grupo_muscular
		ORDER BY nome ASC`

	rows, err := r.pool.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("infrastructure: list grupos musculares: %w", err)
	}
	defer rows.Close()

	out := make([]*domain.GrupoMuscular, 0)
	for rows.Next() {
		var g domain.GrupoMuscular
		if err := rows.Scan(&g.ID, &g.Nome, &g.Descricao); err != nil {
			return nil, fmt.Errorf("infrastructure: scan grupo muscular: %w", err)
		}
		out = append(out, &g)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("infrastructure: iterate grupos musculares: %w", err)
	}
	return out, nil
}

func (r *grupoMuscularRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.GrupoMuscular, error) {
	const q = `
		SELECT id, nome, COALESCE(descricao, '')
		FROM grupo_muscular
		WHERE id = $1`

	var g domain.GrupoMuscular
	err := r.pool.QueryRow(ctx, q, id).Scan(&g.ID, &g.Nome, &g.Descricao)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrGrupoMuscularNotFound
		}
		return nil, fmt.Errorf("infrastructure: find grupo muscular: %w", err)
	}
	return &g, nil
}

// ── Exercicio ──────────────────────────────────────────────────────────────

type exercicioRepo struct {
	pool *pgxpool.Pool
}

func (r *exercicioRepo) Create(ctx context.Context, e *domain.Exercicio) error {
	const q = `
		INSERT INTO exercicio (
			id, personal_id, nome, descricao, grupo_muscular_id,
			midia_url, tipo_midia, ativo
		) VALUES ($1, $2, $3, NULLIF($4, ''), $5, NULLIF($6, ''), NULLIF($7, '')::tipo_midia, $8)
		RETURNING criado_em`

	err := r.pool.QueryRow(ctx, q,
		e.ID, e.PersonalID, e.Nome, e.Descricao, e.GrupoMuscularID,
		e.MidiaURL, e.TipoMidia, e.Ativo,
	).Scan(&e.CriadoEm)
	if err != nil {
		return fmt.Errorf("infrastructure: insert exercicio: %w", err)
	}
	return nil
}

func (r *exercicioRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.ExercicioComGrupo, error) {
	const q = `
		SELECT e.id, e.personal_id, e.nome, COALESCE(e.descricao, ''),
		       e.grupo_muscular_id, COALESCE(e.midia_url, ''),
		       COALESCE(e.tipo_midia::text, ''),
		       e.ativo, e.criado_em, gm.nome
		FROM exercicio e
		JOIN grupo_muscular gm ON gm.id = e.grupo_muscular_id
		WHERE e.id = $1 AND e.ativo = TRUE`

	var ex domain.ExercicioComGrupo
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&ex.ID, &ex.PersonalID, &ex.Nome, &ex.Descricao,
		&ex.GrupoMuscularID, &ex.MidiaURL, &ex.TipoMidia,
		&ex.Ativo, &ex.CriadoEm, &ex.GrupoMuscularNome,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrExercicioNotFound
		}
		return nil, fmt.Errorf("infrastructure: find exercicio: %w", err)
	}
	return &ex, nil
}

func (r *exercicioRepo) List(ctx context.Context, params domain.ListExerciciosParams) ([]*domain.ExercicioComGrupo, error) {
	// O JOIN com grupo_muscular permite ordenar por nome do grupo e devolver
	// o nome em uma única round-trip; os índices parciais existentes em
	// exercicio cobrem o filtro (personal_id = $1 OR personal_id IS NULL).
	const q = `
		SELECT e.id, e.personal_id, e.nome, COALESCE(e.descricao, ''),
		       e.grupo_muscular_id, COALESCE(e.midia_url, ''),
		       COALESCE(e.tipo_midia::text, ''),
		       e.ativo, e.criado_em, gm.nome
		FROM exercicio e
		JOIN grupo_muscular gm ON gm.id = e.grupo_muscular_id
		WHERE e.ativo = TRUE
		  AND (e.personal_id = $1 OR e.personal_id IS NULL)
		  AND ($2::uuid IS NULL OR e.grupo_muscular_id = $2)
		  AND ($3::text = '' OR e.nome ILIKE '%' || $3 || '%')
		ORDER BY gm.nome ASC, e.nome ASC`

	rows, err := r.pool.Query(ctx, q, params.PersonalID, params.GrupoMuscularID, params.Busca)
	if err != nil {
		return nil, fmt.Errorf("infrastructure: list exercicios: %w", err)
	}
	defer rows.Close()

	out := make([]*domain.ExercicioComGrupo, 0)
	for rows.Next() {
		var ex domain.ExercicioComGrupo
		if err := rows.Scan(
			&ex.ID, &ex.PersonalID, &ex.Nome, &ex.Descricao,
			&ex.GrupoMuscularID, &ex.MidiaURL, &ex.TipoMidia,
			&ex.Ativo, &ex.CriadoEm, &ex.GrupoMuscularNome,
		); err != nil {
			return nil, fmt.Errorf("infrastructure: scan exercicio: %w", err)
		}
		out = append(out, &ex)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("infrastructure: iterate exercicios: %w", err)
	}
	return out, nil
}

func (r *exercicioRepo) Update(ctx context.Context, e *domain.Exercicio) error {
	// Não atualizamos mídia aqui (Fase 1 mantém a mídia original do create).
	// O WHERE inclui ativo=TRUE para impedir update de exercícios já desativados.
	const q = `
		UPDATE exercicio
		   SET nome = $2,
		       descricao = NULLIF($3, ''),
		       grupo_muscular_id = $4
		 WHERE id = $1 AND ativo = TRUE`

	tag, err := r.pool.Exec(ctx, q, e.ID, e.Nome, e.Descricao, e.GrupoMuscularID)
	if err != nil {
		return fmt.Errorf("infrastructure: update exercicio: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrExercicioNotFound
	}
	return nil
}

func (r *exercicioRepo) Deactivate(ctx context.Context, id, personalID uuid.UUID) error {
	// Soft delete só é permitido para exercícios do próprio personal.
	// O filtro personal_id = $2 garante que globais (NULL) e de outros donos
	// não sejam afetados — RowsAffected = 0 nesses casos.
	const q = `
		UPDATE exercicio
		   SET ativo = FALSE
		 WHERE id = $1
		   AND personal_id = $2
		   AND ativo = TRUE`

	tag, err := r.pool.Exec(ctx, q, id, personalID)
	if err != nil {
		return fmt.Errorf("infrastructure: deactivate exercicio: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrExercicioForbidden
	}
	return nil
}
