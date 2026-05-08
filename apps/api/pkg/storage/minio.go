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

// publicReadPolicyTemplate é uma policy S3-compatível que concede s3:GetObject
// anônimo a todos os objetos do bucket. Usada pelo bucket "exercicios" para
// servir mídias demonstrativas via URL pública sem presigned-URLs.
const publicReadPolicyTemplate = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": ["*"]},
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::%s/*"]
    }
  ]
}`

// SetBucketPublicRead aplica uma policy public-read no bucket informado.
// Idempotente — chamadas repetidas sobrescrevem a policy com o mesmo conteúdo.
func (c *Client) SetBucketPublicRead(ctx context.Context, bucketName string) error {
	policy := fmt.Sprintf(publicReadPolicyTemplate, bucketName)
	if err := c.mc.SetBucketPolicy(ctx, bucketName, policy); err != nil {
		return fmt.Errorf("storage: set bucket policy %q: %w", bucketName, err)
	}
	log.Info().Str("bucket", bucketName).Msg("storage: public-read policy applied")
	return nil
}
