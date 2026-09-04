package domain

import (
	"context"

	"github.com/google/uuid"
)

// PersonalTrainerRepository define o contrato de persistência para PersonalTrainer.
type PersonalTrainerRepository interface {
	Create(ctx context.Context, pt *PersonalTrainer) error
	FindByID(ctx context.Context, id uuid.UUID) (*PersonalTrainer, error)
	FindByEmail(ctx context.Context, email string) (*PersonalTrainer, error)
	Update(ctx context.Context, pt *PersonalTrainer) error
}

// AlunoFilter agrupa parâmetros opcionais de busca paginada de alunos.
type AlunoFilter struct {
	Ativo   *bool
	Page    int
	PerPage int
}

// AlunoRepository define o contrato de persistência para Aluno.
type AlunoRepository interface {
	Create(ctx context.Context, aluno *Aluno) error
	FindByID(ctx context.Context, id uuid.UUID) (*Aluno, error)
	FindByEmail(ctx context.Context, email string) (*Aluno, error)
	ListByPersonal(ctx context.Context, personalID uuid.UUID, filter AlunoFilter) ([]*Aluno, int, error)
	Update(ctx context.Context, aluno *Aluno) error
	Deactivate(ctx context.Context, id uuid.UUID) error
}

// CredencialRepository define o contrato de persistência para Credencial.
type CredencialRepository interface {
	Create(ctx context.Context, cred *Credencial) error
	FindByOwner(ctx context.Context, ownerID uuid.UUID, ownerType OwnerType) (*Credencial, error)
	UpdatePasswordHash(ctx context.Context, id uuid.UUID, hash string) error
	UpdateUltimoAcesso(ctx context.Context, id uuid.UUID) error
}

// RefreshTokenRepository define o contrato de persistência para RefreshToken.
type RefreshTokenRepository interface {
	Create(ctx context.Context, rt *RefreshToken) error
	FindByJTI(ctx context.Context, jti string) (*RefreshToken, error)
	RevokeByJTI(ctx context.Context, jti string) error
	RevokeAllByOwner(ctx context.Context, ownerID uuid.UUID) error
}

// TenantConfigRepository define o contrato de persistência para TenantConfig.
type TenantConfigRepository interface {
	// FindByPersonalID devolve (nil, nil) quando o personal nunca configurou
	// nenhum branding — não é um erro, é o estado normal de "sem
	// customização ainda" (o caller aplica os defaults visuais do app).
	FindByPersonalID(ctx context.Context, personalID uuid.UUID) (*TenantConfig, error)

	// Upsert insere ou atualiza a config (uma linha por personal_id).
	Upsert(ctx context.Context, cfg *TenantConfig) error
}
