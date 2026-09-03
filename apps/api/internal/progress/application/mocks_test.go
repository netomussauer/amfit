package application

import (
	"context"
	"time"

	"github.com/amfit/api/internal/progress/domain"
	"github.com/google/uuid"
)

// ── HistoricoQueryRepository mock ─────────────────────────────────────────

type mockHistoricoRepo struct {
	historicoCargaFn func(
		ctx context.Context,
		alunoID, exercicioID uuid.UUID,
		from, to time.Time,
		limit int,
	) ([]domain.HistoricoCargaPonto, error)
}

func (m *mockHistoricoRepo) HistoricoCarga(
	ctx context.Context,
	alunoID uuid.UUID,
	exercicioID uuid.UUID,
	from time.Time,
	to time.Time,
	limit int,
) ([]domain.HistoricoCargaPonto, error) {
	if m.historicoCargaFn != nil {
		return m.historicoCargaFn(ctx, alunoID, exercicioID, from, to, limit)
	}
	return []domain.HistoricoCargaPonto{}, nil
}

// ── DashboardQueryRepository mock ─────────────────────────────────────────

type mockDashboardRepo struct {
	resumoFn func(ctx context.Context, personalID uuid.UUID) (domain.DashboardResumo, error)
}

func (m *mockDashboardRepo) Resumo(ctx context.Context, personalID uuid.UUID) (domain.DashboardResumo, error) {
	if m.resumoFn != nil {
		return m.resumoFn(ctx, personalID)
	}
	return domain.DashboardResumo{PersonalID: personalID}, nil
}

// ── AccessRepository mock ──────────────────────────────────────────────────
//
// Padrão: default "permite" (retorna nil) pra reduzir setup repetido nos
// testes de caminho feliz — testes negativos sobrescrevem a função
// correspondente (mesmo padrão de mockTreinoLookup/mockAlunoLookup em
// execution/application/mocks_test.go).

type mockAccessRepo struct {
	alunoExisteEPertenceAoPersonalFn func(ctx context.Context, personalID, alunoID uuid.UUID) error
	exercicioVisivelParaPersonalFn   func(ctx context.Context, personalID, exercicioID uuid.UUID) error
	exercicioVisivelParaAlunoFn      func(ctx context.Context, alunoID, exercicioID uuid.UUID) error
}

func (m *mockAccessRepo) AlunoExisteEPertenceAoPersonal(
	ctx context.Context, personalID, alunoID uuid.UUID,
) error {
	if m.alunoExisteEPertenceAoPersonalFn != nil {
		return m.alunoExisteEPertenceAoPersonalFn(ctx, personalID, alunoID)
	}
	return nil
}

func (m *mockAccessRepo) ExercicioVisivelParaPersonal(
	ctx context.Context, personalID, exercicioID uuid.UUID,
) error {
	if m.exercicioVisivelParaPersonalFn != nil {
		return m.exercicioVisivelParaPersonalFn(ctx, personalID, exercicioID)
	}
	return nil
}

func (m *mockAccessRepo) ExercicioVisivelParaAluno(
	ctx context.Context, alunoID, exercicioID uuid.UUID,
) error {
	if m.exercicioVisivelParaAlunoFn != nil {
		return m.exercicioVisivelParaAlunoFn(ctx, alunoID, exercicioID)
	}
	return nil
}

// ── AnamneseRepository mock ─────────────────────────────────────────────────

type mockAnamneseRepo struct {
	upsertFn        func(ctx context.Context, a *domain.Anamnese) error
	findByAlunoIDFn func(ctx context.Context, alunoID uuid.UUID) (*domain.Anamnese, error)
}

func (m *mockAnamneseRepo) Upsert(ctx context.Context, a *domain.Anamnese) error {
	if m.upsertFn != nil {
		return m.upsertFn(ctx, a)
	}
	a.ID = uuid.New()
	return nil
}

func (m *mockAnamneseRepo) FindByAlunoID(ctx context.Context, alunoID uuid.UUID) (*domain.Anamnese, error) {
	if m.findByAlunoIDFn != nil {
		return m.findByAlunoIDFn(ctx, alunoID)
	}
	return nil, domain.ErrAnamneseNotFound
}

// ── TemplateMatcher mock ────────────────────────────────────────────────────

type mockTemplateMatcher struct {
	melhorMatchFn func(ctx context.Context, personalID uuid.UUID, nivel, objetivo string) (*domain.TemplateMatch, error)
}

func (m *mockTemplateMatcher) MelhorMatch(
	ctx context.Context, personalID uuid.UUID, nivel, objetivo string,
) (*domain.TemplateMatch, error) {
	if m.melhorMatchFn != nil {
		return m.melhorMatchFn(ctx, personalID, nivel, objetivo)
	}
	return nil, nil
}
