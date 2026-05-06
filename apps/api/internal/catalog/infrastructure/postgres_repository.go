// Package infrastructure contém as implementações de repositório para o contexto Catalog.
package infrastructure

import "github.com/jackc/pgx/v5/pgxpool"

// PostgresRepositories agrega os repositórios PostgreSQL do contexto Catalog.
type PostgresRepositories struct {
	pool *pgxpool.Pool
}

// NewPostgresRepositories cria a instância com o pool compartilhado.
func NewPostgresRepositories(pool *pgxpool.Pool) *PostgresRepositories {
	return &PostgresRepositories{pool: pool}
}
