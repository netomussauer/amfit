package domain

import (
	"context"

	"github.com/google/uuid"
)

// SessaoTreinoRepository define o contrato de persistência para SessaoTreino.
type SessaoTreinoRepository interface {
	FindByID(ctx context.Context, id uuid.UUID) (*SessaoTreino, error)
	FindByAlunoID(ctx context.Context, alunoID uuid.UUID) ([]*SessaoTreino, error)
	Save(ctx context.Context, sessao *SessaoTreino) error
	UpdateStatus(ctx context.Context, id uuid.UUID, status StatusSessao) error
}

// RegistroSerieRepository define o contrato de persistência para RegistroSerie.
type RegistroSerieRepository interface {
	FindBySessaoID(ctx context.Context, sessaoID uuid.UUID) ([]*RegistroSerie, error)
	Save(ctx context.Context, registro *RegistroSerie) error
	Upsert(ctx context.Context, registro *RegistroSerie) error
}
