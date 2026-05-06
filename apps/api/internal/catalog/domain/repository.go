package domain

import (
	"context"

	"github.com/google/uuid"
)

// GrupoMuscularRepository define o contrato de persistência para GrupoMuscular.
type GrupoMuscularRepository interface {
	FindAll(ctx context.Context) ([]*GrupoMuscular, error)
	FindByID(ctx context.Context, id uuid.UUID) (*GrupoMuscular, error)
	Save(ctx context.Context, gm *GrupoMuscular) error
}

// ExercicioFilter parametriza a busca de exercícios.
type ExercicioFilter struct {
	PersonalID      *uuid.UUID
	GrupoMuscularID *uuid.UUID
	Busca           string
}

// ExercicioRepository define o contrato de persistência para Exercicio.
type ExercicioRepository interface {
	FindByID(ctx context.Context, id uuid.UUID) (*Exercicio, error)
	Search(ctx context.Context, filter ExercicioFilter) ([]*Exercicio, error)
	Save(ctx context.Context, ex *Exercicio) error
	Delete(ctx context.Context, id uuid.UUID) error
}
