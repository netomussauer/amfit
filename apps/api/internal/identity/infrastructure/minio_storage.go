package infrastructure

import (
	"context"
	"fmt"
	"strings"

	"github.com/amfit/api/internal/identity/application"
	"github.com/amfit/api/pkg/storage"
	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
)

// bucketTenantLogos é o bucket público que armazena os logos customizados
// de White Label. Idêntico ao garantido na startup do main.go.
const bucketTenantLogos = "tenant-logos"

// MinioLogoStorage implementa application.LogoStorage usando o cliente
// MinIO.
type MinioLogoStorage struct {
	client    *storage.Client
	publicURL string
}

// NewMinioLogoStorage instancia o storage com o client MinIO compartilhado
// e a URL pública base (mesmo padrão de publicBaseURL do Catalog).
func NewMinioLogoStorage(client *storage.Client, publicBaseURL string) *MinioLogoStorage {
	return &MinioLogoStorage{
		client:    client,
		publicURL: strings.TrimRight(publicBaseURL, "/"),
	}
}

// UploadLogo faz PutObject no bucket "tenant-logos" com a key
// {personal_id} — sem extensão, deliberadamente: um logo por personal,
// sempre na MESMA key, então trocar o logo (mesmo pra um content-type
// diferente, ex: png -> jpeg) sempre sobrescreve o objeto anterior em vez
// de criar um novo ao lado dele. Uma key {id}.{ext} (variando com o
// content-type do upload) deixaria o objeto antigo órfão no bucket toda
// vez que o tipo de arquivo mudasse entre uploads (achado de code-review).
// O Content-Type correto fica gravado como metadata do objeto — MinIO/S3
// servem o arquivo com esse header independente da URL não ter extensão,
// então <img>/Image renderizam normalmente.
func (s *MinioLogoStorage) UploadLogo(
	ctx context.Context,
	personalID uuid.UUID,
	logo *application.LogoUpload,
) (string, error) {
	key := personalID.String()

	_, err := s.client.Underlying().PutObject(
		ctx,
		bucketTenantLogos,
		key,
		logo.Reader,
		logo.Size,
		minio.PutObjectOptions{ContentType: logo.ContentType},
	)
	if err != nil {
		return "", fmt.Errorf("infrastructure: putobject %s: %w", key, err)
	}

	return fmt.Sprintf("%s/%s", s.publicURL, key), nil
}
