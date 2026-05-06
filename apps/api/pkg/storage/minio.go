// Package storage fornece o wrapper do cliente MinIO para object storage.
package storage

import (
	"context"
	"fmt"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/rs/zerolog/log"
)

// Client encapsula o cliente MinIO com helpers de domínio.
type Client struct {
	mc *minio.Client
}

// NewClient inicializa e valida a conexão com o MinIO.
func NewClient(endpoint, accessKey, secretKey string, useSSL bool) (*Client, error) {
	mc, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("storage: new client: %w", err)
	}

	return &Client{mc: mc}, nil
}

// EnsureBucket cria o bucket caso não exista. Idempotente.
func (c *Client) EnsureBucket(ctx context.Context, bucketName, region string) error {
	exists, err := c.mc.BucketExists(ctx, bucketName)
	if err != nil {
		return fmt.Errorf("storage: bucket exists check %q: %w", bucketName, err)
	}

	if exists {
		log.Debug().Str("bucket", bucketName).Msg("storage: bucket already exists")
		return nil
	}

	if err := c.mc.MakeBucket(ctx, bucketName, minio.MakeBucketOptions{Region: region}); err != nil {
		return fmt.Errorf("storage: make bucket %q: %w", bucketName, err)
	}

	log.Info().Str("bucket", bucketName).Msg("storage: bucket created")
	return nil
}

// Underlying retorna o *minio.Client subjacente para operações avançadas.
func (c *Client) Underlying() *minio.Client {
	return c.mc
}
