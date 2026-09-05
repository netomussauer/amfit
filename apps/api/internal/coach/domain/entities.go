// Package domain define as entidades e tipos do contexto Coach.
package domain

import (
	"time"

	"github.com/google/uuid"
)

// StatusCoachVideo é o ciclo de vida de um CoachVideo.
type StatusCoachVideo string

const (
	StatusCoachVideoAguardandoFeedback StatusCoachVideo = "AGUARDANDO_FEEDBACK"
	StatusCoachVideoFeedbackEnviado    StatusCoachVideo = "FEEDBACK_ENVIADO"
	StatusCoachVideoArquivado          StatusCoachVideo = "ARQUIVADO"
)

// CoachVideo é o clipe de execução enviado pelo aluno pedindo revisão do
// personal — entidade central do contexto (SDD §20.5).
type CoachVideo struct {
	ID              uuid.UUID
	AlunoID         uuid.UUID
	PersonalID      uuid.UUID
	ItemTreinoID    *uuid.UUID
	VideoObjectKey  string
	DuracaoSegundos int
	Status          StatusCoachVideo
	Descricao       string
	CriadoEm        time.Time
	AtualizadoEm    time.Time
}

// CoachVideoFeedback é a resposta do personal a um CoachVideo — entidade
// filha, relação 1:1 com CoachVideo (SDD §20.5). Só texto nesta entrega;
// feedback em áudio fica para uma próxima fatia.
type CoachVideoFeedback struct {
	ID         uuid.UUID
	VideoID    uuid.UUID
	PersonalID uuid.UUID
	Texto      string
	EnviadoEm  time.Time
}

// CoachVideoComFeedback combina um CoachVideo com seu feedback (quando já
// enviado) — devolvido pelas consultas de listagem/detalhe pra evitar N+1
// (uma query com LEFT JOIN em vez de uma busca de feedback por vídeo).
type CoachVideoComFeedback struct {
	CoachVideo
	AlunoNome     string
	ExercicioNome *string
	Feedback      *CoachVideoFeedback
}
