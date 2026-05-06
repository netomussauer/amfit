// Package database fornece utilitários para conexão e operação com PostgreSQL.
package database

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Connect abre um pool de conexões com o PostgreSQL usando a URL fornecida.
// MaxConns=10 e MinConns=2 são aplicados como configuração base.
func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("database: parse config: %w", err)
	}

	cfg.MaxConns = 10
	cfg.MinConns = 2

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("database: create pool: %w", err)
	}

	if err := Healthcheck(ctx, pool); err != nil {
		pool.Close()
		return nil, fmt.Errorf("database: initial healthcheck: %w", err)
	}

	return pool, nil
}

// Healthcheck executa SELECT 1 para verificar se o pool está operacional.
func Healthcheck(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, "SELECT 1"); err != nil {
		return fmt.Errorf("database: healthcheck: %w", err)
	}
	return nil
}
