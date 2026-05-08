package application

import (
	"context"
	"io"

	"github.com/google/uuid"
)

// GrupoMuscularResponse é o DTO de saída para um grupo muscular.
type GrupoMuscularResponse struct {
	ID   string `json:"id"`
	Nome string `json:"nome"`
}

// GrupoMuscularListResponse encapsula a lista completa de grupos musculares.
type GrupoMuscularListResponse struct {
	Data []GrupoMuscularResponse `json:"data"`
}

// ExercicioResponse é o DTO de saída para um exercício, com o grupo muscular
// embutido para evitar segundo round-trip do cliente.
type ExercicioResponse struct {
	ID            string                `json:"id"`
	Nome          string                `json:"nome"`
	Descricao     string                `json:"descricao,omitempty"`
	GrupoMuscular GrupoMuscularResponse `json:"grupo_muscular"`
	MidiaURL      string                `json:"midia_url,omitempty"`
	TipoMidia     string                `json:"tipo_midia,omitempty"`
	IsGlobal      bool                  `json:"is_global"`
}

// ExercicioListResponse encapsula a lista de exercícios.
type ExercicioListResponse struct {
	Data []ExercicioResponse `json:"data"`
}

// CriarExercicioInput é a parte textual do POST /exercicios (multipart/form-data).
// O arquivo de mídia é representado por *MidiaUpload e validado em separado.
type CriarExercicioInput struct {
	Nome            string `validate:"required,min=2,max=150"`
	Descricao       string `validate:"max=2000"`
	GrupoMuscularID string `validate:"required,uuid"`
}

// AtualizarExercicioInput é o body do PATCH /exercicios/{id}. Cada campo é
// opcional — somente os não-nulos são aplicados.
type AtualizarExercicioInput struct {
	Nome            *string `json:"nome,omitempty" validate:"omitempty,min=2,max=150"`
	Descricao       *string `json:"descricao,omitempty" validate:"omitempty,max=2000"`
	GrupoMuscularID *string `json:"grupo_muscular_id,omitempty" validate:"omitempty,uuid"`
}

// MidiaUpload representa o arquivo de mídia recebido no multipart. Reader
// deve ser consumido apenas uma vez; o caller é responsável por fechá-lo
// quando aplicável.
type MidiaUpload struct {
	Filename    string
	ContentType string
	Size        int64
	Reader      io.Reader
}

// MidiaStorage é o port que abstrai o armazenamento de mídia (MinIO/S3).
// Permite que o serviço seja testado sem depender da infraestrutura.
type MidiaStorage interface {
	// UploadMidia persiste o conteúdo de midia no bucket de exercícios e
	// retorna a URL pública para acesso.
	UploadMidia(ctx context.Context, exercicioID uuid.UUID, midia *MidiaUpload) (string, error)
}
