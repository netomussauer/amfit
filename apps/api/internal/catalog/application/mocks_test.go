package application

import (
	"context"

	"github.com/amfit/api/internal/catalog/domain"
	"github.com/google/uuid"
)

// ── GrupoMuscular mock ─────────────────────────────────────────────────────

type mockGrupoRepo struct {
	listAllFn  func(ctx context.Context) ([]*domain.GrupoMuscular, error)
	findByIDFn func(ctx context.Context, id uuid.UUID) (*domain.GrupoMuscular, error)
}

func (m *mockGrupoRepo) ListAll(ctx context.Context) ([]*domain.GrupoMuscular, error) {
	if m.listAllFn != nil {
		return m.listAllFn(ctx)
	}
	return nil, nil
}

func (m *mockGrupoRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.GrupoMuscular, error) {
	if m.findByIDFn != nil {
		return m.findByIDFn(ctx, id)
	}
	// Por padrão devolve um grupo válido — facilita testes que não focam no
	// caminho de validação do grupo.
	return &domain.GrupoMuscular{ID: id, Nome: "Peitoral"}, nil
}

// ── Exercicio mock ─────────────────────────────────────────────────────────

type mockExercicioRepo struct {
	createFn     func(ctx context.Context, e *domain.Exercicio) error
	findByIDFn   func(ctx context.Context, id uuid.UUID) (*domain.ExercicioComGrupo, error)
	listFn       func(ctx context.Context, p domain.ListExerciciosParams) ([]*domain.ExercicioComGrupo, error)
	updateFn     func(ctx context.Context, e *domain.Exercicio) error
	deactivateFn func(ctx context.Context, id, personalID uuid.UUID) error
}

func (m *mockExercicioRepo) Create(ctx context.Context, e *domain.Exercicio) error {
	if m.createFn != nil {
		return m.createFn(ctx, e)
	}
	return nil
}

func (m *mockExercicioRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.ExercicioComGrupo, error) {
	if m.findByIDFn != nil {
		return m.findByIDFn(ctx, id)
	}
	return nil, domain.ErrExercicioNotFound
}

func (m *mockExercicioRepo) List(
	ctx context.Context,
	p domain.ListExerciciosParams,
) ([]*domain.ExercicioComGrupo, error) {
	if m.listFn != nil {
		return m.listFn(ctx, p)
	}
	return nil, nil
}

func (m *mockExercicioRepo) Update(ctx context.Context, e *domain.Exercicio) error {
	if m.updateFn != nil {
		return m.updateFn(ctx, e)
	}
	return nil
}

func (m *mockExercicioRepo) Deactivate(ctx context.Context, id, personalID uuid.UUID) error {
	if m.deactivateFn != nil {
		return m.deactivateFn(ctx, id, personalID)
	}
	return nil
}

// ── MidiaStorage mock ──────────────────────────────────────────────────────

type mockMidiaStorage struct {
	uploadFn func(ctx context.Context, exID uuid.UUID, m *MidiaUpload) (string, error)
}

func (m *mockMidiaStorage) UploadMidia(
	ctx context.Context,
	exID uuid.UUID,
	upload *MidiaUpload,
) (string, error) {
	if m.uploadFn != nil {
		return m.uploadFn(ctx, exID, upload)
	}
	return "http://example.test/exercicios/" + exID.String(), nil
}
