package application

import (
	"context"

	"github.com/amfit/api/internal/training/domain"
	"github.com/google/uuid"
)

// ── Ficha mock ─────────────────────────────────────────────────────────────

type mockFichaRepo struct {
	createFn          func(ctx context.Context, f *domain.FichaTreino) error
	findByIDFn        func(ctx context.Context, id uuid.UUID) (*domain.FichaTreino, error)
	listFn            func(ctx context.Context, filter domain.ListFichasFilter) ([]*domain.FichaTreino, error)
	findAtivaByAlunoFn func(ctx context.Context, alunoID uuid.UUID) (*domain.FichaTreino, error)
	updateFn          func(ctx context.Context, f *domain.FichaTreino) error
	deactivateFn      func(ctx context.Context, id uuid.UUID) error
}

func (m *mockFichaRepo) Create(ctx context.Context, f *domain.FichaTreino) error {
	if m.createFn != nil {
		return m.createFn(ctx, f)
	}
	return nil
}

func (m *mockFichaRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.FichaTreino, error) {
	if m.findByIDFn != nil {
		return m.findByIDFn(ctx, id)
	}
	return nil, domain.ErrFichaNotFound
}

func (m *mockFichaRepo) List(
	ctx context.Context,
	filter domain.ListFichasFilter,
) ([]*domain.FichaTreino, error) {
	if m.listFn != nil {
		return m.listFn(ctx, filter)
	}
	return nil, nil
}

func (m *mockFichaRepo) FindAtivaByAluno(ctx context.Context, alunoID uuid.UUID) (*domain.FichaTreino, error) {
	if m.findAtivaByAlunoFn != nil {
		return m.findAtivaByAlunoFn(ctx, alunoID)
	}
	return nil, domain.ErrSemFichaAtiva
}

func (m *mockFichaRepo) Update(ctx context.Context, f *domain.FichaTreino) error {
	if m.updateFn != nil {
		return m.updateFn(ctx, f)
	}
	return nil
}

func (m *mockFichaRepo) Deactivate(ctx context.Context, id uuid.UUID) error {
	if m.deactivateFn != nil {
		return m.deactivateFn(ctx, id)
	}
	return nil
}

// ── Treino mock ────────────────────────────────────────────────────────────

type mockTreinoRepo struct {
	createFn      func(ctx context.Context, t *domain.Treino) error
	findByIDFn    func(ctx context.Context, id uuid.UUID) (*domain.Treino, error)
	listByFichaFn func(ctx context.Context, fichaID uuid.UUID) ([]*domain.Treino, error)
	updateFn      func(ctx context.Context, t *domain.Treino) error
	deleteFn      func(ctx context.Context, id uuid.UUID) error
}

func (m *mockTreinoRepo) Create(ctx context.Context, t *domain.Treino) error {
	if m.createFn != nil {
		return m.createFn(ctx, t)
	}
	return nil
}

func (m *mockTreinoRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.Treino, error) {
	if m.findByIDFn != nil {
		return m.findByIDFn(ctx, id)
	}
	return nil, domain.ErrTreinoNotFound
}

func (m *mockTreinoRepo) ListByFicha(ctx context.Context, fichaID uuid.UUID) ([]*domain.Treino, error) {
	if m.listByFichaFn != nil {
		return m.listByFichaFn(ctx, fichaID)
	}
	return nil, nil
}

func (m *mockTreinoRepo) Update(ctx context.Context, t *domain.Treino) error {
	if m.updateFn != nil {
		return m.updateFn(ctx, t)
	}
	return nil
}

func (m *mockTreinoRepo) Delete(ctx context.Context, id uuid.UUID) error {
	if m.deleteFn != nil {
		return m.deleteFn(ctx, id)
	}
	return nil
}

// ── Item mock ──────────────────────────────────────────────────────────────

type mockItemRepo struct {
	createFn       func(ctx context.Context, i *domain.ItemTreino) error
	findByIDFn     func(ctx context.Context, id uuid.UUID) (*domain.ItemTreino, error)
	listByTreinoFn func(ctx context.Context, treinoID uuid.UUID) ([]*domain.ItemTreino, error)
	updateFn       func(ctx context.Context, i *domain.ItemTreino) error
	deleteFn       func(ctx context.Context, id uuid.UUID) error
	reorderFn      func(ctx context.Context, treinoID uuid.UUID, ids []uuid.UUID) error
}

func (m *mockItemRepo) Create(ctx context.Context, i *domain.ItemTreino) error {
	if m.createFn != nil {
		return m.createFn(ctx, i)
	}
	return nil
}

func (m *mockItemRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.ItemTreino, error) {
	if m.findByIDFn != nil {
		return m.findByIDFn(ctx, id)
	}
	return nil, domain.ErrItemTreinoNotFound
}

func (m *mockItemRepo) ListByTreino(ctx context.Context, treinoID uuid.UUID) ([]*domain.ItemTreino, error) {
	if m.listByTreinoFn != nil {
		return m.listByTreinoFn(ctx, treinoID)
	}
	return nil, nil
}

func (m *mockItemRepo) Update(ctx context.Context, i *domain.ItemTreino) error {
	if m.updateFn != nil {
		return m.updateFn(ctx, i)
	}
	return nil
}

func (m *mockItemRepo) Delete(ctx context.Context, id uuid.UUID) error {
	if m.deleteFn != nil {
		return m.deleteFn(ctx, id)
	}
	return nil
}

func (m *mockItemRepo) Reorder(ctx context.Context, treinoID uuid.UUID, ids []uuid.UUID) error {
	if m.reorderFn != nil {
		return m.reorderFn(ctx, treinoID, ids)
	}
	return nil
}

// ── FichaCompleta mock ─────────────────────────────────────────────────────

type mockFichaCompletaRepo struct {
	getCompletaFn func(ctx context.Context, fichaID uuid.UUID) (*domain.FichaCompleta, error)
}

func (m *mockFichaCompletaRepo) GetCompleta(ctx context.Context, fichaID uuid.UUID) (*domain.FichaCompleta, error) {
	if m.getCompletaFn != nil {
		return m.getCompletaFn(ctx, fichaID)
	}
	return nil, domain.ErrFichaNotFound
}

// ── TreinoHoje mock ────────────────────────────────────────────────────────

type mockTreinoHojeRepo struct {
	getTreinoHojeFn func(ctx context.Context, alunoID uuid.UUID) (*domain.TreinoCompleto, error)
}

func (m *mockTreinoHojeRepo) GetTreinoHoje(ctx context.Context, alunoID uuid.UUID) (*domain.TreinoCompleto, error) {
	if m.getTreinoHojeFn != nil {
		return m.getTreinoHojeFn(ctx, alunoID)
	}
	return nil, domain.ErrSemFichaAtiva
}

// ── AlunoLookup mock ───────────────────────────────────────────────────────

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
	// Por padrão considera que pertence — testes de "ownership negativo"
	// devem sobrescrever explicitamente.
	return true, nil
}
