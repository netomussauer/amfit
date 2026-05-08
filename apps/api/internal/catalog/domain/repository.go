package domain

import (
	"context"

	"github.com/google/uuid"
)

// ListExerciciosParams parametriza a busca de exercícios visíveis a um personal.
// Inclui sempre os exercícios globais (personal_id IS NULL) somados aos do
// próprio personal.
type ListExerciciosParams struct {
	PersonalID      uuid.UUID
	GrupoMuscularID *uuid.UUID
	Busca           string
}

// GrupoMuscularRepository define o contrato de persistência para GrupoMuscular.
type GrupoMuscularRepository interface {
	ListAll(ctx context.Context) ([]*GrupoMuscular, error)
	FindByID(ctx context.Context, id uuid.UUID) (*GrupoMuscular, error)
}

// ExercicioRepository define o contrato de persistência para Exercicio.
type ExercicioRepository interface {
	Create(ctx context.Context, e *Exercicio) error
	FindByID(ctx context.Context, id uuid.UUID) (*ExercicioComGrupo, error)
	List(ctx context.Context, params ListExerciciosParams) ([]*ExercicioComGrupo, error)
	Update(ctx context.Context, e *Exercicio) error
	// Deactivate aplica soft delete e valida que o exercício pertence ao
	// personal informado — exercícios globais não podem ser desativados.
	Deactivate(ctx context.Context, id, personalID uuid.UUID) error
}
