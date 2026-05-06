package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// MedidaCorporalRepository define o contrato de persistência para MedidaCorporal.
type MedidaCorporalRepository interface {
	FindByAlunoID(ctx context.Context, alunoID uuid.UUID, from, to time.Time) ([]*MedidaCorporal, error)
	Save(ctx context.Context, medida *MedidaCorporal) error
}

// AnamneseRepository define o contrato de persistência para Anamnese.
type AnamneseRepository interface {
	FindByAlunoID(ctx context.Context, alunoID uuid.UUID) (*Anamnese, error)
	Save(ctx context.Context, anamnese *Anamnese) error
}
