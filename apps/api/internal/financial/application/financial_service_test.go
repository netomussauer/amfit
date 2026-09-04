package application

import (
	"context"
	"testing"
	"time"

	"github.com/amfit/api/internal/financial/domain"
	"github.com/google/uuid"
)

func newFinancialServiceForTest() (*FinancialService, *mockPlanoAlunoRepo, *mockMensalidadeRepo, *mockAlunoLookup, *mockNotifier) {
	planos := &mockPlanoAlunoRepo{}
	mensalidades := &mockMensalidadeRepo{}
	alunos := &mockAlunoLookup{}
	notifier := &mockNotifier{}
	return NewFinancialService(planos, mensalidades, alunos, notifier), planos, mensalidades, alunos, notifier
}

// ── ConfigurarPlano ──────────────────────────────────────────────────────

func TestConfigurarPlano_AlunoNaoPertenceAoPersonal_DevolveNaoEncontrado(t *testing.T) {
	svc, _, _, alunos, _ := newFinancialServiceForTest()
	alunos.belongsToPersonalFn = func(ctx context.Context, alunoID, personalID uuid.UUID) (bool, error) {
		return false, nil
	}

	_, err := svc.ConfigurarPlano(context.Background(), uuid.New(), uuid.New(), CriarPlanoRequest{
		ValorMensal: 200, DiaVencimento: 10,
	})
	if err != domain.ErrPlanoNaoEncontrado {
		t.Fatalf("esperado ErrPlanoNaoEncontrado, got %v", err)
	}
}

func TestConfigurarPlano_AlunoJaTemPlanoAtivo_DevolveErro(t *testing.T) {
	svc, planos, _, _, _ := newFinancialServiceForTest()
	planos.findAtivoByAlunoFn = func(ctx context.Context, alunoID uuid.UUID) (*domain.PlanoAluno, error) {
		return &domain.PlanoAluno{ID: uuid.New()}, nil
	}

	_, err := svc.ConfigurarPlano(context.Background(), uuid.New(), uuid.New(), CriarPlanoRequest{
		ValorMensal: 200, DiaVencimento: 10,
	})
	if err != domain.ErrPlanoJaAtivo {
		t.Fatalf("esperado ErrPlanoJaAtivo, got %v", err)
	}
}

func TestConfigurarPlano_CriaComStatusAtivo(t *testing.T) {
	svc, planos, _, _, _ := newFinancialServiceForTest()
	var salvo *domain.PlanoAluno
	planos.createFn = func(ctx context.Context, p *domain.PlanoAluno) error {
		salvo = p
		return nil
	}

	resp, err := svc.ConfigurarPlano(context.Background(), uuid.New(), uuid.New(), CriarPlanoRequest{
		ValorMensal: 250, DiaVencimento: 5, Observacao: "combinado no whatsapp",
	})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if salvo.Status != domain.StatusPlanoAtivo {
		t.Errorf("esperado status ATIVO, got %s", salvo.Status)
	}
	if resp.ValorMensal != 250 || resp.DiaVencimento != 5 {
		t.Errorf("valores incorretos no response: %+v", resp)
	}
}

// ── AtualizarPlano ───────────────────────────────────────────────────────

func TestAtualizarPlano_DeOutroPersonal_DevolveNaoEncontrado(t *testing.T) {
	svc, planos, _, _, _ := newFinancialServiceForTest()
	dono := uuid.New()
	planos.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.PlanoAluno, error) {
		return &domain.PlanoAluno{ID: id, PersonalID: dono}, nil
	}

	_, err := svc.AtualizarPlano(context.Background(), uuid.New(), uuid.New(), AtualizarPlanoRequest{})
	if err != domain.ErrPlanoNaoEncontrado {
		t.Fatalf("esperado ErrPlanoNaoEncontrado, got %v", err)
	}
}

func TestAtualizarPlano_VigenciaFimVazia_Limpa(t *testing.T) {
	svc, planos, _, _, _ := newFinancialServiceForTest()
	personalID := uuid.New()
	fimAtual := ptrTime(t, "2026-12-31")
	planos.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.PlanoAluno, error) {
		return &domain.PlanoAluno{ID: id, PersonalID: personalID, VigenciaFim: fimAtual}, nil
	}
	var salvo *domain.PlanoAluno
	planos.updateFn = func(ctx context.Context, p *domain.PlanoAluno) error {
		salvo = p
		return nil
	}

	vazio := ""
	_, err := svc.AtualizarPlano(context.Background(), personalID, uuid.New(), AtualizarPlanoRequest{
		VigenciaFim: &vazio,
	})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if salvo.VigenciaFim != nil {
		t.Errorf("esperado vigencia_fim nil apos limpar, got %v", salvo.VigenciaFim)
	}
}

// ── MarcarPaga ───────────────────────────────────────────────────────────

func TestMarcarPaga_MensalidadeJaPaga_DevolveErro(t *testing.T) {
	svc, _, mensalidades, _, _ := newFinancialServiceForTest()
	alunoID := uuid.New()
	mensalidades.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.Mensalidade, error) {
		return &domain.Mensalidade{ID: id, AlunoID: alunoID, Status: domain.StatusMensalidadePaga}, nil
	}

	_, err := svc.MarcarPaga(context.Background(), uuid.New(), uuid.New(), MarcarPagaRequest{
		FormaPagamento: "PIX",
	})
	if err != domain.ErrMensalidadeJaPaga {
		t.Fatalf("esperado ErrMensalidadeJaPaga, got %v", err)
	}
}

func TestMarcarPaga_MensalidadeCancelada_DevolveErro(t *testing.T) {
	svc, _, mensalidades, _, _ := newFinancialServiceForTest()
	alunoID := uuid.New()
	mensalidades.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.Mensalidade, error) {
		return &domain.Mensalidade{ID: id, AlunoID: alunoID, Status: domain.StatusMensalidadeCancelada}, nil
	}

	_, err := svc.MarcarPaga(context.Background(), uuid.New(), uuid.New(), MarcarPagaRequest{
		FormaPagamento: "PIX",
	})
	if err != domain.ErrStatusMensalidadeInvalido {
		t.Fatalf("esperado ErrStatusMensalidadeInvalido, got %v", err)
	}
}

func TestMarcarPaga_DeOutroPersonal_DevolveNaoEncontrada(t *testing.T) {
	svc, _, mensalidades, alunos, _ := newFinancialServiceForTest()
	mensalidades.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.Mensalidade, error) {
		return &domain.Mensalidade{ID: id, AlunoID: uuid.New(), Status: domain.StatusMensalidadePendente}, nil
	}
	alunos.belongsToPersonalFn = func(ctx context.Context, alunoID, personalID uuid.UUID) (bool, error) {
		return false, nil
	}

	_, err := svc.MarcarPaga(context.Background(), uuid.New(), uuid.New(), MarcarPagaRequest{
		FormaPagamento: "PIX",
	})
	if err != domain.ErrMensalidadeNaoEncontrada {
		t.Fatalf("esperado ErrMensalidadeNaoEncontrada, got %v", err)
	}
}

func TestMarcarPaga_SemValorInformado_UsaValorCheioENotificaAluno(t *testing.T) {
	svc, _, mensalidades, _, notifier := newFinancialServiceForTest()
	alunoID := uuid.New()
	mensalidades.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.Mensalidade, error) {
		return &domain.Mensalidade{
			ID: id, AlunoID: alunoID, Status: domain.StatusMensalidadePendente,
			Valor: 200, CompetenciaAno: 2026, CompetenciaMes: 9,
		}, nil
	}
	var salvo *domain.Mensalidade
	mensalidades.updateFn = func(ctx context.Context, m *domain.Mensalidade) error {
		salvo = m
		return nil
	}
	var notificouAluno uuid.UUID
	var notificouValor float64
	notifier.notificarMensalidadePagaFn = func(ctx context.Context, alunoID uuid.UUID, competencia string, valor float64) error {
		notificouAluno = alunoID
		notificouValor = valor
		return nil
	}

	_, err := svc.MarcarPaga(context.Background(), uuid.New(), uuid.New(), MarcarPagaRequest{
		FormaPagamento: "PIX",
	})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if salvo.Status != domain.StatusMensalidadePaga {
		t.Errorf("esperado status PAGA, got %s", salvo.Status)
	}
	if salvo.ValorPago == nil || *salvo.ValorPago != 200 {
		t.Errorf("esperado valor_pago=200 (valor cheio), got %v", salvo.ValorPago)
	}
	if notificouAluno != alunoID || notificouValor != 200 {
		t.Errorf("notificacao incorreta: aluno=%v valor=%v", notificouAluno, notificouValor)
	}
}

func TestMarcarPaga_FalhaNaNotificacao_NaoFalhaOCasoDeUso(t *testing.T) {
	svc, _, mensalidades, _, notifier := newFinancialServiceForTest()
	mensalidades.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.Mensalidade, error) {
		return &domain.Mensalidade{ID: id, AlunoID: uuid.New(), Status: domain.StatusMensalidadePendente, Valor: 200}, nil
	}
	notifier.notificarMensalidadePagaFn = func(ctx context.Context, alunoID uuid.UUID, competencia string, valor float64) error {
		return errUpstreamIndisponivel
	}

	resp, err := svc.MarcarPaga(context.Background(), uuid.New(), uuid.New(), MarcarPagaRequest{
		FormaPagamento: "PIX",
	})
	if err != nil {
		t.Fatalf("falha de notificacao nao deveria propagar erro, got %v", err)
	}
	if resp.Status != string(domain.StatusMensalidadePaga) {
		t.Errorf("esperado status PAGA mesmo com falha de notificacao, got %s", resp.Status)
	}
}

// ── AtualizarStatusMensalidade ───────────────────────────────────────────

func TestAtualizarStatusMensalidade_JaPaga_DevolveErro(t *testing.T) {
	svc, _, mensalidades, _, _ := newFinancialServiceForTest()
	mensalidades.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.Mensalidade, error) {
		return &domain.Mensalidade{ID: id, AlunoID: uuid.New(), Status: domain.StatusMensalidadePaga}, nil
	}

	_, err := svc.AtualizarStatusMensalidade(context.Background(), uuid.New(), uuid.New(), AtualizarStatusMensalidadeRequest{
		Status: "CANCELADA",
	})
	if err != domain.ErrStatusMensalidadeInvalido {
		t.Fatalf("esperado ErrStatusMensalidadeInvalido, got %v", err)
	}
}

// ── EnviarLembretesVencimento ────────────────────────────────────────────

func TestEnviarLembretesVencimento_MarcaEnviadoApenasParaOsNotificadosComSucesso(t *testing.T) {
	svc, _, mensalidades, _, notifier := newFinancialServiceForTest()
	m1 := &domain.Mensalidade{ID: uuid.New(), AlunoID: uuid.New(), Valor: 100, DataVencimento: timeNow()}
	m2 := &domain.Mensalidade{ID: uuid.New(), AlunoID: uuid.New(), Valor: 150, DataVencimento: timeNow()}
	mensalidades.listarParaLembreteFn = func(ctx context.Context, limit int) ([]*domain.Mensalidade, error) {
		return []*domain.Mensalidade{m1, m2}, nil
	}
	notifier.notificarMensalidadeVencendoFn = func(ctx context.Context, alunoID uuid.UUID, diasRestantes int, valor float64) error {
		if alunoID == m1.AlunoID {
			return errUpstreamIndisponivel
		}
		return nil
	}
	marcados := map[uuid.UUID]bool{}
	mensalidades.marcarLembreteEnviadoFn = func(ctx context.Context, id uuid.UUID) error {
		marcados[id] = true
		return nil
	}

	n, err := svc.EnviarLembretesVencimento(context.Background(), 10)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if n != 1 {
		t.Errorf("esperado 1 lembrete enviado com sucesso, got %d", n)
	}
	if marcados[m1.ID] {
		t.Errorf("m1 falhou na notificacao — nao deveria ser marcada como lembrete enviado")
	}
	if !marcados[m2.ID] {
		t.Errorf("m2 deveria ter sido marcada como lembrete enviado")
	}
}

// ── helpers ──────────────────────────────────────────────────────────────

var errUpstreamIndisponivel = &testError{"upstream indisponivel"}

type testError struct{ msg string }

func (e *testError) Error() string { return e.msg }

func ptrTime(t *testing.T, s string) *time.Time {
	t.Helper()
	tm, err := time.Parse(dateLayout, s)
	if err != nil {
		t.Fatalf("data invalida no teste: %v", err)
	}
	return &tm
}

func timeNow() time.Time {
	return time.Now().UTC().Truncate(24 * time.Hour)
}
