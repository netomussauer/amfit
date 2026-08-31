package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/amfit/api/internal/progress/domain"
	"github.com/google/uuid"
)

// newServiceForTest devolve um ProgressService com mocks injetados, expostos
// para configuração caso a caso (mesmo padrão de execution/application).
func newServiceForTest() (
	*ProgressService,
	*mockHistoricoRepo,
	*mockDashboardRepo,
	*mockAccessRepo,
) {
	historico := &mockHistoricoRepo{}
	dashboard := &mockDashboardRepo{}
	access := &mockAccessRepo{}

	svc := NewProgressService(historico, dashboard, access)
	return svc, historico, dashboard, access
}

var errBoom = errors.New("erro simulado")

// ── HistoricoDoAlunoLogado ───────────────────────────────────────────────

func TestHistoricoDoAlunoLogado_ExercicioVisivel_DevolveHistorico(t *testing.T) {
	svc, historico, _, access := newServiceForTest()

	alunoID := uuid.New()
	exercicioID := uuid.New()
	pontos := []domain.HistoricoCargaPonto{
		{SessaoID: uuid.New(), NumeroSerie: 1},
	}

	access.exercicioVisivelParaAlunoFn = func(ctx context.Context, a, e uuid.UUID) error {
		if a != alunoID || e != exercicioID {
			t.Errorf("ExercicioVisivelParaAluno: argumentos errados (%v, %v)", a, e)
		}
		return nil
	}
	historico.historicoCargaFn = func(
		ctx context.Context, a, e uuid.UUID, from, to time.Time, limit int,
	) ([]domain.HistoricoCargaPonto, error) {
		if a != alunoID || e != exercicioID {
			t.Errorf("HistoricoCarga: argumentos errados (%v, %v)", a, e)
		}
		return pontos, nil
	}

	resp, err := svc.HistoricoDoAlunoLogado(context.Background(), alunoID, exercicioID, HistoricoParams{})
	if err != nil {
		t.Fatalf("HistoricoDoAlunoLogado: %v", err)
	}
	if resp.AlunoID != alunoID || resp.ExercicioID != exercicioID {
		t.Errorf("resposta com aluno/exercicio errados: %+v", resp)
	}
	if len(resp.Pontos) != 1 {
		t.Fatalf("esperado 1 ponto, got %d", len(resp.Pontos))
	}
}

func TestHistoricoDoAlunoLogado_ExercicioNaoVisivel_NaoConsultaHistorico(t *testing.T) {
	svc, historico, _, access := newServiceForTest()

	access.exercicioVisivelParaAlunoFn = func(ctx context.Context, a, e uuid.UUID) error {
		return domain.ErrExercicioNotFound
	}
	chamouHistorico := false
	historico.historicoCargaFn = func(
		ctx context.Context, a, e uuid.UUID, from, to time.Time, limit int,
	) ([]domain.HistoricoCargaPonto, error) {
		chamouHistorico = true
		return nil, nil
	}

	_, err := svc.HistoricoDoAlunoLogado(context.Background(), uuid.New(), uuid.New(), HistoricoParams{})
	if !errors.Is(err, domain.ErrExercicioNotFound) {
		t.Fatalf("esperado ErrExercicioNotFound, got %v", err)
	}
	if chamouHistorico {
		t.Error("HistoricoCarga não deveria ter sido chamado — acesso negado antes")
	}
}

func TestHistoricoDoAlunoLogado_AccessNil_PulaChecagemEChamaHistorico(t *testing.T) {
	// NewProgressService documenta aceitar nil para historico/dashboard/access
	// durante o scaffolding — confirma que esse caminho realmente funciona
	// (sem panic de nil pointer) e consulta o histórico direto.
	historico := &mockHistoricoRepo{}
	svc := NewProgressService(historico, nil, nil)

	chamouHistorico := false
	historico.historicoCargaFn = func(
		ctx context.Context, a, e uuid.UUID, from, to time.Time, limit int,
	) ([]domain.HistoricoCargaPonto, error) {
		chamouHistorico = true
		return nil, nil
	}

	_, err := svc.HistoricoDoAlunoLogado(context.Background(), uuid.New(), uuid.New(), HistoricoParams{})
	if err != nil {
		t.Fatalf("HistoricoDoAlunoLogado com access nil: %v", err)
	}
	if !chamouHistorico {
		t.Error("HistoricoCarga deveria ter sido chamado mesmo sem access configurado")
	}
}

func TestHistoricoDoAlunoLogado_HistoricoRepoNil_RetornaErroSemPanic(t *testing.T) {
	// Achado de code-review: NewProgressService documenta aceitar nil para
	// historico/dashboard/access durante o scaffolding, mas só `access` era
	// de fato nil-safe — historico/dashboard nil causavam panic. Este teste
	// (e o próximo, para Dashboard) cobrem o caminho que faltava.
	svc := NewProgressService(nil, &mockDashboardRepo{}, &mockAccessRepo{})

	_, err := svc.HistoricoDoAlunoLogado(context.Background(), uuid.New(), uuid.New(), HistoricoParams{})
	if !errors.Is(err, domain.ErrRepositorioNaoConfigurado) {
		t.Fatalf("esperado ErrRepositorioNaoConfigurado, got %v", err)
	}
}

// ── HistoricoDoAlunoVistoPeloPersonal ────────────────────────────────────

func TestHistoricoDoAlunoVistoPeloPersonal_TudoVisivel_DevolveHistorico(t *testing.T) {
	svc, historico, _, access := newServiceForTest()

	personalID := uuid.New()
	alunoID := uuid.New()
	exercicioID := uuid.New()

	var ordem []string
	access.alunoExisteEPertenceAoPersonalFn = func(ctx context.Context, p, a uuid.UUID) error {
		ordem = append(ordem, "aluno")
		return nil
	}
	access.exercicioVisivelParaPersonalFn = func(ctx context.Context, p, e uuid.UUID) error {
		ordem = append(ordem, "exercicio")
		return nil
	}
	historico.historicoCargaFn = func(
		ctx context.Context, a, e uuid.UUID, from, to time.Time, limit int,
	) ([]domain.HistoricoCargaPonto, error) {
		ordem = append(ordem, "historico")
		return []domain.HistoricoCargaPonto{{NumeroSerie: 1}}, nil
	}

	resp, err := svc.HistoricoDoAlunoVistoPeloPersonal(
		context.Background(), personalID, alunoID, exercicioID, HistoricoParams{},
	)
	if err != nil {
		t.Fatalf("HistoricoDoAlunoVistoPeloPersonal: %v", err)
	}
	if len(resp.Pontos) != 1 {
		t.Errorf("esperado 1 ponto, got %d", len(resp.Pontos))
	}

	esperado := []string{"aluno", "exercicio", "historico"}
	if len(ordem) != len(esperado) {
		t.Fatalf("ordem de chamadas errada: %v", ordem)
	}
	for i, v := range esperado {
		if ordem[i] != v {
			t.Errorf("ordem de chamadas errada: esperado %v, got %v", esperado, ordem)
			break
		}
	}
}

func TestHistoricoDoAlunoVistoPeloPersonal_AlunoNaoPertenceAoPersonal_NaoChecaExercicioNemHistorico(t *testing.T) {
	svc, historico, _, access := newServiceForTest()

	access.alunoExisteEPertenceAoPersonalFn = func(ctx context.Context, p, a uuid.UUID) error {
		return domain.ErrAlunoNotFound
	}
	chamouExercicio := false
	access.exercicioVisivelParaPersonalFn = func(ctx context.Context, p, e uuid.UUID) error {
		chamouExercicio = true
		return nil
	}
	chamouHistorico := false
	historico.historicoCargaFn = func(
		ctx context.Context, a, e uuid.UUID, from, to time.Time, limit int,
	) ([]domain.HistoricoCargaPonto, error) {
		chamouHistorico = true
		return nil, nil
	}

	_, err := svc.HistoricoDoAlunoVistoPeloPersonal(
		context.Background(), uuid.New(), uuid.New(), uuid.New(), HistoricoParams{},
	)
	if !errors.Is(err, domain.ErrAlunoNotFound) {
		t.Fatalf("esperado ErrAlunoNotFound, got %v", err)
	}
	if chamouExercicio {
		t.Error("ExercicioVisivelParaPersonal não deveria ter sido chamado — aluno já falhou")
	}
	if chamouHistorico {
		t.Error("HistoricoCarga não deveria ter sido chamado — acesso negado antes")
	}
}

func TestHistoricoDoAlunoVistoPeloPersonal_ExercicioNaoVisivel_NaoConsultaHistorico(t *testing.T) {
	svc, historico, _, access := newServiceForTest()

	access.exercicioVisivelParaPersonalFn = func(ctx context.Context, p, e uuid.UUID) error {
		return domain.ErrExercicioNotFound
	}
	chamouHistorico := false
	historico.historicoCargaFn = func(
		ctx context.Context, a, e uuid.UUID, from, to time.Time, limit int,
	) ([]domain.HistoricoCargaPonto, error) {
		chamouHistorico = true
		return nil, nil
	}

	_, err := svc.HistoricoDoAlunoVistoPeloPersonal(
		context.Background(), uuid.New(), uuid.New(), uuid.New(), HistoricoParams{},
	)
	if !errors.Is(err, domain.ErrExercicioNotFound) {
		t.Fatalf("esperado ErrExercicioNotFound, got %v", err)
	}
	if chamouHistorico {
		t.Error("HistoricoCarga não deveria ter sido chamado — acesso negado antes")
	}
}

func TestHistoricoDoAlunoVistoPeloPersonal_PropagaErroDoRepositorio(t *testing.T) {
	svc, historico, _, _ := newServiceForTest()

	historico.historicoCargaFn = func(
		ctx context.Context, a, e uuid.UUID, from, to time.Time, limit int,
	) ([]domain.HistoricoCargaPonto, error) {
		return nil, errBoom
	}

	_, err := svc.HistoricoDoAlunoVistoPeloPersonal(
		context.Background(), uuid.New(), uuid.New(), uuid.New(), HistoricoParams{},
	)
	if !errors.Is(err, errBoom) {
		t.Fatalf("esperado erro do repositório propagado, got %v", err)
	}
}

// ── HistoricoParams — defaults e resolução ───────────────────────────────

func TestHistoricoParams_SemParametros_UsaJanelaEDefaultLimit(t *testing.T) {
	svc, historico, _, _ := newServiceForTest()

	var capturedFrom, capturedTo time.Time
	var capturedLimit int
	historico.historicoCargaFn = func(
		ctx context.Context, a, e uuid.UUID, from, to time.Time, limit int,
	) ([]domain.HistoricoCargaPonto, error) {
		capturedFrom, capturedTo, capturedLimit = from, to, limit
		return nil, nil
	}

	before := time.Now().UTC()
	_, err := svc.HistoricoDoAlunoLogado(context.Background(), uuid.New(), uuid.New(), HistoricoParams{})
	after := time.Now().UTC()
	if err != nil {
		t.Fatalf("HistoricoDoAlunoLogado: %v", err)
	}

	// `to` e `from` derivam do mesmo `now` interno — a diferença entre eles
	// deve ser EXATAMENTE historicoIntervaloPadrao (365 dias), independente
	// de quando o teste rodou.
	if diff := capturedTo.Sub(capturedFrom); diff != historicoIntervaloPadrao {
		t.Errorf("intervalo esperado %v, got %v", historicoIntervaloPadrao, diff)
	}
	// `to` (o "now" interno) deve estar dentro da janela de execução do teste.
	if capturedTo.Before(before) || capturedTo.After(after) {
		t.Errorf("to=%v esperado entre %v e %v", capturedTo, before, after)
	}
	if capturedLimit != historicoLimitDefault {
		t.Errorf("limit esperado %d (default), got %d", historicoLimitDefault, capturedLimit)
	}
}

func TestHistoricoParams_ComFromToExplicitos_RespeitaValoresInformados(t *testing.T) {
	svc, historico, _, _ := newServiceForTest()

	from := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)

	var capturedFrom, capturedTo time.Time
	historico.historicoCargaFn = func(
		ctx context.Context, a, e uuid.UUID, f, t2 time.Time, limit int,
	) ([]domain.HistoricoCargaPonto, error) {
		capturedFrom, capturedTo = f, t2
		return nil, nil
	}

	_, err := svc.HistoricoDoAlunoLogado(context.Background(), uuid.New(), uuid.New(), HistoricoParams{
		From: &from,
		To:   &to,
	})
	if err != nil {
		t.Fatalf("HistoricoDoAlunoLogado: %v", err)
	}
	if !capturedFrom.Equal(from) {
		t.Errorf("from esperado %v, got %v", from, capturedFrom)
	}
	if !capturedTo.Equal(to) {
		t.Errorf("to esperado %v, got %v", to, capturedTo)
	}
}

func TestHistoricoParams_ResolveLimit(t *testing.T) {
	tests := []struct {
		nome     string
		limit    *int
		esperado int
	}{
		{"nil cai no default", nil, historicoLimitDefault},
		{"zero cai no default (nao > 0)", intPtr(0), historicoLimitDefault},
		{"negativo cai no default", intPtr(-10), historicoLimitDefault},
		{"acima do teto cai no default", intPtr(historicoLimitDefault + 1), historicoLimitDefault},
		{"exatamente no teto e respeitado", intPtr(historicoLimitDefault), historicoLimitDefault},
		{"valor valido e respeitado", intPtr(100), 100},
	}

	for _, tt := range tests {
		t.Run(tt.nome, func(t *testing.T) {
			svc, historico, _, _ := newServiceForTest()

			var capturedLimit int
			historico.historicoCargaFn = func(
				ctx context.Context, a, e uuid.UUID, from, to time.Time, limit int,
			) ([]domain.HistoricoCargaPonto, error) {
				capturedLimit = limit
				return nil, nil
			}

			_, err := svc.HistoricoDoAlunoLogado(context.Background(), uuid.New(), uuid.New(), HistoricoParams{
				Limit: tt.limit,
			})
			if err != nil {
				t.Fatalf("HistoricoDoAlunoLogado: %v", err)
			}
			if capturedLimit != tt.esperado {
				t.Errorf("limit esperado %d, got %d", tt.esperado, capturedLimit)
			}
		})
	}
}

func intPtr(n int) *int { return &n }

// ── Dashboard ─────────────────────────────────────────────────────────────

func TestDashboard_DevolveResumoDoPersonal(t *testing.T) {
	svc, _, dashboard, _ := newServiceForTest()

	personalID := uuid.New()
	esperado := domain.DashboardResumo{
		PersonalID:           personalID,
		AlunosAtivos:         12,
		FichasAtivas:         8,
		SessoesUltimos7Dias:  5,
		SessoesUltimos30Dias: 20,
		AlunosSemSessao7Dias: 3,
	}
	dashboard.resumoFn = func(ctx context.Context, p uuid.UUID) (domain.DashboardResumo, error) {
		if p != personalID {
			t.Errorf("Resumo: personalID errado, esperado %v got %v", personalID, p)
		}
		return esperado, nil
	}

	resp, err := svc.Dashboard(context.Background(), personalID)
	if err != nil {
		t.Fatalf("Dashboard: %v", err)
	}
	if resp != esperado {
		t.Errorf("resumo esperado %+v, got %+v", esperado, resp)
	}
}

func TestDashboard_PropagaErroDoRepositorio(t *testing.T) {
	svc, _, dashboard, _ := newServiceForTest()

	dashboard.resumoFn = func(ctx context.Context, p uuid.UUID) (domain.DashboardResumo, error) {
		return domain.DashboardResumo{}, errBoom
	}

	_, err := svc.Dashboard(context.Background(), uuid.New())
	if !errors.Is(err, errBoom) {
		t.Fatalf("esperado erro do repositório propagado, got %v", err)
	}
}

func TestDashboard_DashboardRepoNil_RetornaErroSemPanic(t *testing.T) {
	svc := NewProgressService(&mockHistoricoRepo{}, nil, &mockAccessRepo{})

	_, err := svc.Dashboard(context.Background(), uuid.New())
	if !errors.Is(err, domain.ErrRepositorioNaoConfigurado) {
		t.Fatalf("esperado ErrRepositorioNaoConfigurado, got %v", err)
	}
}
