package domain

import (
	"context"

	"github.com/google/uuid"
)

// CoachVideoRepository persiste CoachVideo e resolve as consultas
// combinadas com feedback (LEFT JOIN — ver CoachVideoComFeedback).
type CoachVideoRepository interface {
	Create(ctx context.Context, v *CoachVideo) error

	// FindComFeedback devolve o vídeo (com feedback, se houver). Devolve
	// (nil, nil) quando não existe — não é um erro.
	FindComFeedback(ctx context.Context, id uuid.UUID) (*CoachVideoComFeedback, error)

	// ListByPersonal lista os vídeos dos alunos do personal, mais recentes
	// primeiro, opcionalmente filtrados por status.
	ListByPersonal(
		ctx context.Context,
		personalID uuid.UUID,
		status *StatusCoachVideo,
		page, perPage int,
	) ([]*CoachVideoComFeedback, int, error)

	// ListByAluno lista os vídeos do próprio aluno autenticado.
	ListByAluno(ctx context.Context, alunoID uuid.UUID, page, perPage int) ([]*CoachVideoComFeedback, int, error)

	// MarcarFeedbackEnviado transiciona AGUARDANDO_FEEDBACK → FEEDBACK_ENVIADO.
	MarcarFeedbackEnviado(ctx context.Context, videoID uuid.UUID) error
}

// CoachVideoFeedbackRepository persiste CoachVideoFeedback.
type CoachVideoFeedbackRepository interface {
	Create(ctx context.Context, f *CoachVideoFeedback) error
}
