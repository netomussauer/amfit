package application

import (
	"context"

	"github.com/amfit/api/internal/notification/domain"
	"github.com/google/uuid"
)

type mockTokenRepo struct {
	upsertFn func(ctx context.Context, t *domain.PushToken) error
}

func (m *mockTokenRepo) Upsert(ctx context.Context, t *domain.PushToken) error {
	if m.upsertFn != nil {
		return m.upsertFn(ctx, t)
	}
	return nil
}

func (m *mockTokenRepo) ListaAtivosPorOwner(
	ctx context.Context, ownerID uuid.UUID, ownerTipo domain.OwnerTipo,
) ([]domain.PushToken, error) {
	return nil, nil
}

type mockNotifRepo struct {
	criarFn func(ctx context.Context, n *domain.Notificacao) error
}

func (m *mockNotifRepo) Criar(ctx context.Context, n *domain.Notificacao) error {
	if m.criarFn != nil {
		return m.criarFn(ctx, n)
	}
	return nil
}

func (m *mockNotifRepo) ListarPendentes(ctx context.Context, limit int) ([]domain.Notificacao, error) {
	return nil, nil
}

func (m *mockNotifRepo) MarcarEnviada(ctx context.Context, id uuid.UUID) error { return nil }

func (m *mockNotifRepo) MarcarErro(ctx context.Context, id uuid.UUID, detalhe string) error {
	return nil
}
