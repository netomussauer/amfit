// Package cache fornece o cliente Redis para a aplicação.
package cache

import (
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"
)

// Connect cria e valida um cliente Redis a partir de uma URL.
// Formato esperado: redis://:senha@host:porta/db ou redis://host:porta/db
func Connect(ctx context.Context, redisURL string) (*redis.Client, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("cache: parse url: %w", err)
	}

	client := redis.NewClient(opts)

	if err := Ping(ctx, client); err != nil {
		_ = client.Close() // melhor esforço no close de erro de startup
		return nil, err
	}

	return client, nil
}

// Ping verifica se o cliente consegue comunicar com o servidor Redis.
func Ping(ctx context.Context, client *redis.Client) error {
	if err := client.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("cache: ping: %w", err)
	}
	return nil
}
