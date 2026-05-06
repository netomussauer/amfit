package domain

import (
	"context"

	"github.com/google/uuid"
)

// FichaTreinoRepository define o contrato de persistência para FichaTreino.
type FichaTreinoRepository interface {
	FindByID(ctx context.Context, id uuid.UUID) (*FichaTreino, error)
	FindByAlunoID(ctx context.Context, alunoID uuid.UUID, apenasAtiva bool) ([]*FichaTreino, error)
	FindByPersonalID(ctx context.Context, personalID uuid.UUID) ([]*FichaTreino, error)
	Save(ctx context.Context, ficha *FichaTreino) error
}

// TreinoRepository define o contrato de persistência para Treino.
type TreinoRepository interface {
	FindByID(ctx context.Context, id uuid.UUID) (*Treino, error)
	FindByFichaID(ctx context.Context, fichaID uuid.UUID) ([]*Treino, error)
	Save(ctx context.Context, treino *Treino) error
}

// ItemTreinoRepository define o contrato de persistência para ItemTreino.
type ItemTreinoRepository interface {
	FindByID(ctx context.Context, id uuid.UUID) (*ItemTreino, error)
	FindByTreinoID(ctx context.Context, treinoID uuid.UUID) ([]*ItemTreino, error)
	Save(ctx context.Context, item *ItemTreino) error
	Delete(ctx context.Context, id uuid.UUID) error
}
