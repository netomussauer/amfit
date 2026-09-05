package infrastructure

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/amfit/api/internal/coach/application"
	"github.com/amfit/api/pkg/storage"
	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
)

// bucketCoachVideos é o bucket privado que armazena os clipes enviados
// pelos alunos — idêntico ao garantido na startup do main.go. Diferente do
// bucket "exercicios"/"tenant-logos", NUNCA recebe policy public-read: os
// clipes só são acessíveis via presigned URL (SDD §20.5 — "dados
// sensíveis").
const bucketCoachVideos = "coach-videos"

// presignedURLTTL é o tempo de vida da URL assinada devolvida ao personal
// pra assistir o vídeo — mesmo valor decidido no SDD §20.5.
const presignedURLTTL = 24 * time.Hour

// MinioVideoStorage implementa application.VideoStorage usando o cliente
// MinIO compartilhado.
type MinioVideoStorage struct {
	client *storage.Client
}

// NewMinioVideoStorage instancia o storage com o client MinIO compartilhado.
func NewMinioVideoStorage(client *storage.Client) *MinioVideoStorage {
	return &MinioVideoStorage{client: client}
}

// UploadVideo faz PutObject no bucket "coach-videos" com a key
// {personal_id}/{video_id} — sem extensão (o Content-Type gravado como
// metadata do objeto já garante a reprodução correta, mesmo padrão adotado
// pro logo de White Label em identity/infrastructure/minio_storage.go).
func (s *MinioVideoStorage) UploadVideo(
	ctx context.Context,
	personalID, alunoID, videoID uuid.UUID,
	video *application.VideoUpload,
) (string, error) {
	key := fmt.Sprintf("%s/%s", personalID.String(), videoID.String())

	_, err := s.client.Underlying().PutObject(
		ctx,
		bucketCoachVideos,
		key,
		video.Reader,
		video.Size,
		minio.PutObjectOptions{ContentType: video.ContentType},
	)
	if err != nil {
		return "", fmt.Errorf("infrastructure: putobject %s: %w", key, err)
	}

	return key, nil
}

// PresignedURL gera uma URL assinada (TTL 24h) pra assistir o vídeo — o
// bucket é privado, então essa é a única forma de acesso.
func (s *MinioVideoStorage) PresignedURL(ctx context.Context, objectKey string) (string, error) {
	u, err := s.client.Underlying().PresignedGetObject(ctx, bucketCoachVideos, objectKey, presignedURLTTL, url.Values{})
	if err != nil {
		return "", fmt.Errorf("infrastructure: presigned url %s: %w", objectKey, err)
	}
	return u.String(), nil
}
