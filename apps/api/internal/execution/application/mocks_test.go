package application

import (
	"context"
	"time"

	"github.com/amfit/api/internal/execution/domain"
	"github.com/google/uuid"
)

// ── SessaoRepository mock ─────────────────────────────────────────────────

type mockSessaoRepo struct {
	createFn              func(ctx context.Context, s *domain.SessaoTreino) error
	findByIDFn            func(ctx context.Context, id uuid.UUID) (*domain.SessaoTreino, error)
	findEmAndamentoHojeFn func(ctx context.Context, alunoID, treinoID uuid.UUID) (*domain.SessaoTreino, error)
	updateStatusFn        func(ctx context.Context, id uuid.UUID, status domain.StatusSessao, concluidoEm *time.Time) error
	listByAlunoFn         func(ctx context.Context, alunoID uuid.UUID, page, perPage int) ([]*domain.SessaoComResumo, int, error)
}

func (m *mockSessaoRepo) Create(ctx context.Context, s *domain.SessaoTreino) error {
	if m.createFn != nil {
		return m.createFn(ctx, s)
	}
	return nil
}

func (m *mockSessaoRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.SessaoTreino, error) {
	if m.findByIDFn != nil {
		return m.findByIDFn(ctx, id)
	}
	return nil, domain.ErrSessaoNotFound
}

func (m *mockSessaoRepo) FindEmAndamentoHoje(
	ctx context.Context,
	alunoID, treinoID uuid.UUID,
) (*domain.SessaoTreino, error) {
	if m.findEmAndamentoHojeFn != nil {
		return m.findEmAndamentoHojeFn(ctx, alunoID, treinoID)
	}
	return nil, domain.ErrSessaoNotFound
}

func (m *mockSessaoRepo) UpdateStatus(
	ctx context.Context,
	id uuid.UUID,
	status domain.StatusSessao,
	concluidoEm *time.Time,
) error {
	if m.updateStatusFn != nil {
		return m.updateStatusFn(ctx, id, status, concluidoEm)
	}
	return nil
}

func (m *mockSessaoRepo) ListByAluno(
	ctx context.Context,
	alunoID uuid.UUID,
	page, perPage int,
) ([]*domain.SessaoComResumo, int, error) {
	if m.listByAlunoFn != nil {
		return m.listByAlunoFn(ctx, alunoID, page, perPage)
	}
	return nil, 0, nil
}

// ── RegistroSerieRepository mock ──────────────────────────────────────────

type mockRegistroRepo struct {
	upsertFn        func(ctx context.Context, r *domain.RegistroSerie) error
	listBySessaoFn  func(ctx context.Context, sessaoID uuid.UUID) ([]*domain.RegistroSerie, error)
	countBySessaoFn func(ctx context.Context, sessaoID uuid.UUID) (int, int, error)
}

func (m *mockRegistroRepo) Upsert(ctx context.Context, r *domain.RegistroSerie) error {
	if m.upsertFn != nil {
		return m.upsertFn(ctx, r)
	}
	return nil
}

func (m *mockRegistroRepo) ListBySessao(ctx context.Context, sessaoID uuid.UUID) ([]*domain.RegistroSerie, error) {
	if m.listBySessaoFn != nil {
		return m.listBySessaoFn(ctx, sessaoID)
	}
	return []*domain.RegistroSerie{}, nil
}

func (m *mockRegistroRepo) CountBySessao(ctx context.Context, sessaoID uuid.UUID) (int, int, error) {
	if m.countBySessaoFn != nil {
		return m.countBySessaoFn(ctx, sessaoID)
	}
	return 0, 0, nil
}

// ── TreinoLookup mock ─────────────────────────────────────────────────────

type mockTreinoLookup struct {
	getTreinoComItensFn    func(ctx context.Context, treinoID uuid.UUID) (string, string, []domain.ItemBasico, error)
	validarTreinoDoAlunoFn func(ctx context.Context, alunoID, treinoID uuid.UUID) (bool, error)
}

func (m *mockTreinoLookup) GetTreinoComItens(
	ctx context.Context,
	treinoID uuid.UUID,
) (string, string, []domain.ItemBasico, error) {
	if m.getTreinoComItensFn != nil {
		return m.getTreinoComItensFn(ctx, treinoID)
	}
	return "A", "", nil, nil
}

func (m *mockTreinoLookup) ValidarTreinoDoAluno(
	ctx context.Context,
	alunoID, treinoID uuid.UUID,
) (bool, error) {
	if m.validarTreinoDoAlunoFn != nil {
		return m.validarTreinoDoAlunoFn(ctx, alunoID, treinoID)
	}
	// Padrão: trata como válido para reduzir setup repetido — testes
	// negativos sobrescrevem.
	return true, nil
}

// ── AlunoLookup mock ──────────────────────────────────────────────────────

type mockAlunoLookup struct {
	belongsFn func(ctx context.Context, alunoID, personalID uuid.UUID) (bool, error)
}

func (m *mockAlunoLookup) BelongsToPersonal(
	ctx context.Context,
	alunoID, personalID uuid.UUID,
) (bool, error) {
	if m.belongsFn != nil {
		return m.belongsFn(ctx, alunoID, personalID)
	}
	return true, nil
}
