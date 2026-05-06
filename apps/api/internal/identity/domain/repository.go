package domain

import (
	"context"

	"github.com/google/uuid"
)

// PersonalTrainerRepository define o contrato de persistência para PersonalTrainer.
type PersonalTrainerRepository interface {
	FindByID(ctx context.Context, id uuid.UUID) (*PersonalTrainer, error)
	FindByEmail(ctx context.Context, email string) (*PersonalTrainer, error)
	Save(ctx context.Context, pt *PersonalTrainer) error
}

// AlunoRepository define o contrato de persistência para Aluno.
type AlunoRepository interface {
	FindByID(ctx context.Context, id uuid.UUID) (*Aluno, error)
	FindByPersonalID(ctx context.Context, personalID uuid.UUID, apenasAtivos bool) ([]*Aluno, error)
	FindByEmail(ctx context.Context, email string) (*Aluno, error)
	Save(ctx context.Context, aluno *Aluno) error
}

// CredencialRepository define o contrato de persistência para Credencial.
type CredencialRepository interface {
	FindByOwner(ctx context.Context, ownerID uuid.UUID, ownerType OwnerType) (*Credencial, error)
	Save(ctx context.Context, cred *Credencial) error
	UpdateUltimoAcesso(ctx context.Context, id uuid.UUID) error
}

// RefreshTokenRepository define o contrato de persistência para RefreshToken.
type RefreshTokenRepository interface {
	FindByJTI(ctx context.Context, jti string) (*RefreshToken, error)
	Save(ctx context.Context, rt *RefreshToken) error
	Revoke(ctx context.Context, jti string) error
	RevokeAllByOwner(ctx context.Context, ownerID uuid.UUID) error
}
