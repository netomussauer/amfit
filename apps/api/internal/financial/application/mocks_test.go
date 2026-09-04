package application

import (
	"context"

	"github.com/amfit/api/internal/financial/domain"
	"github.com/google/uuid"
)

// ── PlanoAlunoRepository mock ───────────────────────────────────────────

type mockPlanoAlunoRepo struct {
	createFn                  func(ctx context.Context, p *domain.PlanoAluno) error
	findByIDFn                func(ctx context.Context, id uuid.UUID) (*domain.PlanoAluno, error)
	findAtivoByAlunoFn        func(ctx context.Context, alunoID uuid.UUID) (*domain.PlanoAluno, error)
	updateFn                  func(ctx context.Context, p *domain.PlanoAluno) error
	listarAtivosParaGeracaoFn func(ctx context.Context) ([]*domain.PlanoAluno, error)
}

func (m *mockPlanoAlunoRepo) Create(ctx context.Context, p *domain.PlanoAluno) error {
	if m.createFn != nil {
		return m.createFn(ctx, p)
	}
	return nil
}

func (m *mockPlanoAlunoRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.PlanoAluno, error) {
	if m.findByIDFn != nil {
		return m.findByIDFn(ctx, id)
	}
	return nil, nil
}

func (m *mockPlanoAlunoRepo) FindAtivoByAluno(ctx context.Context, alunoID uuid.UUID) (*domain.PlanoAluno, error) {
	if m.findAtivoByAlunoFn != nil {
		return m.findAtivoByAlunoFn(ctx, alunoID)
	}
	return nil, nil
}

func (m *mockPlanoAlunoRepo) Update(ctx context.Context, p *domain.PlanoAluno) error {
	if m.updateFn != nil {
		return m.updateFn(ctx, p)
	}
	return nil
}

func (m *mockPlanoAlunoRepo) ListarAtivosParaGeracao(ctx context.Context) ([]*domain.PlanoAluno, error) {
	if m.listarAtivosParaGeracaoFn != nil {
		return m.listarAtivosParaGeracaoFn(ctx)
	}
	return nil, nil
}

// ── MensalidadeRepository mock ──────────────────────────────────────────

type mockMensalidadeRepo struct {
	findByIDFn              func(ctx context.Context, id uuid.UUID) (*domain.Mensalidade, error)
	updateFn                func(ctx context.Context, m *domain.Mensalidade) error
	listByPersonalFn        func(ctx context.Context, personalID uuid.UUID, params domain.ListarMensalidadesParams) ([]*domain.Mensalidade, int, error)
	listByAlunoFn           func(ctx context.Context, alunoID uuid.UUID, params domain.ListarMensalidadesParams) ([]*domain.Mensalidade, int, error)
	dashboardFn             func(ctx context.Context, personalID uuid.UUID) (*domain.DashboardFinanceiro, error)
	gerarPendentesFn        func(ctx context.Context) (int, error)
	marcarAtrasadasFn       func(ctx context.Context) (int, error)
	listarParaLembreteFn    func(ctx context.Context, limit int) ([]*domain.Mensalidade, error)
	marcarLembreteEnviadoFn func(ctx context.Context, id uuid.UUID) error
}

func (m *mockMensalidadeRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.Mensalidade, error) {
	if m.findByIDFn != nil {
		return m.findByIDFn(ctx, id)
	}
	return nil, nil
}

func (m *mockMensalidadeRepo) Update(ctx context.Context, mn *domain.Mensalidade) error {
	if m.updateFn != nil {
		return m.updateFn(ctx, mn)
	}
	return nil
}

func (m *mockMensalidadeRepo) ListByPersonal(ctx context.Context, personalID uuid.UUID, params domain.ListarMensalidadesParams) ([]*domain.Mensalidade, int, error) {
	if m.listByPersonalFn != nil {
		return m.listByPersonalFn(ctx, personalID, params)
	}
	return nil, 0, nil
}

func (m *mockMensalidadeRepo) ListByAluno(ctx context.Context, alunoID uuid.UUID, params domain.ListarMensalidadesParams) ([]*domain.Mensalidade, int, error) {
	if m.listByAlunoFn != nil {
		return m.listByAlunoFn(ctx, alunoID, params)
	}
	return nil, 0, nil
}

func (m *mockMensalidadeRepo) Dashboard(ctx context.Context, personalID uuid.UUID) (*domain.DashboardFinanceiro, error) {
	if m.dashboardFn != nil {
		return m.dashboardFn(ctx, personalID)
	}
	return &domain.DashboardFinanceiro{}, nil
}

func (m *mockMensalidadeRepo) GerarPendentes(ctx context.Context) (int, error) {
	if m.gerarPendentesFn != nil {
		return m.gerarPendentesFn(ctx)
	}
	return 0, nil
}

func (m *mockMensalidadeRepo) MarcarAtrasadas(ctx context.Context) (int, error) {
	if m.marcarAtrasadasFn != nil {
		return m.marcarAtrasadasFn(ctx)
	}
	return 0, nil
}

func (m *mockMensalidadeRepo) ListarParaLembrete(ctx context.Context, limit int) ([]*domain.Mensalidade, error) {
	if m.listarParaLembreteFn != nil {
		return m.listarParaLembreteFn(ctx, limit)
	}
	return nil, nil
}

func (m *mockMensalidadeRepo) MarcarLembreteEnviado(ctx context.Context, id uuid.UUID) error {
	if m.marcarLembreteEnviadoFn != nil {
		return m.marcarLembreteEnviadoFn(ctx, id)
	}
	return nil
}

// ── AlunoLookup mock ─────────────────────────────────────────────────────

type mockAlunoLookup struct {
	belongsToPersonalFn func(ctx context.Context, alunoID, personalID uuid.UUID) (bool, error)
}

func (m *mockAlunoLookup) BelongsToPersonal(ctx context.Context, alunoID, personalID uuid.UUID) (bool, error) {
	if m.belongsToPersonalFn != nil {
		return m.belongsToPersonalFn(ctx, alunoID, personalID)
	}
	return true, nil
}

// ── Notifier mock ────────────────────────────────────────────────────────

type mockNotifier struct {
	notificarMensalidadePagaFn     func(ctx context.Context, alunoID uuid.UUID, competencia string, valor float64) error
	notificarMensalidadeVencendoFn func(ctx context.Context, alunoID uuid.UUID, diasRestantes int, valor float64) error
}

func (m *mockNotifier) NotificarMensalidadePaga(ctx context.Context, alunoID uuid.UUID, competencia string, valor float64) error {
	if m.notificarMensalidadePagaFn != nil {
		return m.notificarMensalidadePagaFn(ctx, alunoID, competencia, valor)
	}
	return nil
}

func (m *mockNotifier) NotificarMensalidadeVencendo(ctx context.Context, alunoID uuid.UUID, diasRestantes int, valor float64) error {
	if m.notificarMensalidadeVencendoFn != nil {
		return m.notificarMensalidadeVencendoFn(ctx, alunoID, diasRestantes, valor)
	}
	return nil
}
