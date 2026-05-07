// Package config carrega a configuração da aplicação a partir de variáveis de ambiente.
package config

import (
	"os"
	"strconv"
)

// Config agrupa todas as configurações da aplicação lidas do ambiente.
type Config struct {
	// Database
	DatabaseURL string

	// Redis
	RedisURL string

	// MinIO
	MinioEndpoint  string
	MinioAccessKey string
	MinioSecretKey string
	MinioUseSSL    bool

	// JWT
	JWTPrivateKeyPath string
	JWTPublicKeyPath  string

	// Server
	Port string
	Env  string
}

// Load lê as variáveis de ambiente e retorna um Config populado com fallbacks.
func Load() *Config {
	return &Config{
		DatabaseURL: getEnv("DATABASE_URL", "postgres://amfit:amfit123%21@localhost:5432/amfit?sslmode=disable"),
		RedisURL:    getEnv("REDIS_URL", "redis://:redis123%21@localhost:6379/0"),

		MinioEndpoint:  getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinioAccessKey: getEnv("MINIO_ACCESS_KEY", "amfit-minio"),
		MinioSecretKey: getEnv("MINIO_SECRET_KEY", "amfit-minio-secret"),
		MinioUseSSL:    getEnvBool("MINIO_USE_SSL", false),

		JWTPrivateKeyPath: getEnv("JWT_PRIVATE_KEY_PATH", "keys/private.pem"),
		JWTPublicKeyPath:  getEnv("JWT_PUBLIC_KEY_PATH", "keys/public.pem"),

		Port: getEnv("PORT", "8080"),
		Env:  getEnv("ENV", "development"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return b
}
