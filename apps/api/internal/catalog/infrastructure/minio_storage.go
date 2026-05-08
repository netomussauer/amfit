package infrastructure

import (
	"context"
	"fmt"
	"mime"
	"path/filepath"
	"strings"

	"github.com/amfit/api/internal/catalog/application"
	"github.com/amfit/api/pkg/storage"
	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
)

// bucketExercicios é o bucket público que armazena vídeos/GIFs/imagens
// demonstrativos dos exercícios. Idêntico ao garantido na startup do main.
const bucketExercicios = "exercicios"

// MinioStorage implementa application.MidiaStorage usando o cliente MinIO.
type MinioStorage struct {
	client    *storage.Client
	publicURL string // ex: "http://localhost:9000/exercicios" ou "https://minio.amfit.local/exercicios"
}

// NewMinioStorage instancia o storage com o client MinIO compartilhado e a
// URL pública base usada para construir a URL retornada ao cliente.
//
// publicBaseURL é tratado como prefixo até o nome do bucket; trailing slash
// é normalizado para evitar duplicação ao concatenar com o object key.
func NewMinioStorage(client *storage.Client, publicBaseURL string) *MinioStorage {
	return &MinioStorage{
		client:    client,
		publicURL: strings.TrimRight(publicBaseURL, "/"),
	}
}

// UploadMidia faz PutObject no bucket "exercicios" com a key {id}.{ext} e
// retorna a URL pública construída a partir da configuração injetada.
//
// A extensão é derivada primeiro do filename original; se inexistente, usa
// o content-type para resolver. Em último caso devolve "" (sem extensão), o
// que ainda é válido — o servidor MinIO serve o objeto pelo header.
func (s *MinioStorage) UploadMidia(
	ctx context.Context,
	exercicioID uuid.UUID,
	midia *application.MidiaUpload,
) (string, error) {
	ext := extensionFor(midia.Filename, midia.ContentType)

	key := exercicioID.String()
	if ext != "" {
		key = key + ext
	}

	_, err := s.client.Underlying().PutObject(
		ctx,
		bucketExercicios,
		key,
		midia.Reader,
		midia.Size,
		minio.PutObjectOptions{ContentType: midia.ContentType},
	)
	if err != nil {
		return "", fmt.Errorf("infrastructure: putobject %s: %w", key, err)
	}

	return fmt.Sprintf("%s/%s", s.publicURL, key), nil
}

// extensionFor extrai a extensão (com ponto) a partir do filename. Se o
// filename não trouxer extensão, mapeia o content-type para uma extensão
// canônica via mime.ExtensionsByType.
func extensionFor(filename, contentType string) string {
	if ext := strings.ToLower(filepath.Ext(filename)); ext != "" {
		return ext
	}

	ct := contentType
	if i := strings.Index(ct, ";"); i >= 0 {
		ct = strings.TrimSpace(ct[:i])
	}
	switch strings.ToLower(ct) {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/gif":
		return ".gif"
	case "video/mp4":
		return ".mp4"
	}

	// fallback genérico via mime package
	if exts, _ := mime.ExtensionsByType(ct); len(exts) > 0 {
		return exts[0]
	}
	return ""
}
