package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/amfit/api/internal/execution/domain"
	"github.com/google/uuid"
)

// newServiceForTest devolve um ExecutionService com mocks injetados, expostos
// para configuração caso a caso.
func newServiceForTest() (
	*ExecutionService,
	*mockSessaoRepo,
	*mockRegistroRepo,
	*mockTreinoLookup,
	*mockAlunoLookup,
) {
	sessoes := &mockSessaoRepo{}
	registros := &mockRegistroRepo{}
	treinos := &mockTreinoLookup{}
	alunos := &mockAlunoLookup{}

	svc := NewExecutionService(sessoes, registros, treinos, alunos, &mockNotifier{})
	return svc, sessoes, registros, treinos, alunos
}

// newServiceForNotifierTest expõe também os mocks de AlunoLookup e Notifier
// — testes do gatilho de notificação em ConcluirSessao usam este helper.
func newServiceForNotifierTest() (
	*ExecutionService,
	*mockSessaoRepo,
	*mockAlunoLookup,
	*mockNotifier,
) {
	sessoes := &mockSessaoRepo{}
	alunos := &mockAlunoLookup{}
	notifier := &mockNotifier{}

	svc := NewExecutionService(sessoes, &mockRegistroRepo{}, &mockTreinoLookup{}, alunos, notifier)
	return svc, sessoes, alunos, notifier
}

// ── IniciarSessao ─────────────────────────────────────────────────────────

func TestIniciarSessao_TreinoValido_CriaEmAndamento(t *testing.T) {
	svc, sessoes, _, treinos, _ := newServiceForTest()

	alunoID := uuid.New()
	treinoID := uuid.New()

	treinos.validarTreinoDoAlunoFn = func(ctx context.Context, a, tid uuid.UUID) (bool, error) {
		if a != alunoID || tid != treinoID {
			t.Errorf("ValidarTreinoDoAluno: argumentos errados (%v, %v)", a, tid)
		}
		return true, nil
	}

	created := false
	sessoes.createFn = func(ctx context.Context, s *domain.SessaoTreino) error {
		created = true
		if s.AlunoID != alunoID {
			t.Errorf("aluno_id esperado %v, got %v", alunoID, s.AlunoID)
		}
		if s.TreinoID != treinoID {
			t.Errorf("treino_id esperado %v, got %v", treinoID, s.TreinoID)
		}
		if s.Status != domain.StatusEmAndamento {
			t.Errorf("status esperado EM_ANDAMENTO, got %v", s.Status)
		}
		if s.IniciadoEm.IsZero() {
			t.Error("iniciado_em deveria estar preenchido")
		}
		return nil
	}

	resp, err := svc.IniciarSessao(context.Background(), alunoID, IniciarSessaoRequest{
		TreinoID: treinoID.String(),
	})
	if err != nil {
		t.Fatalf("IniciarSessao: %v", err)
	}
	if !created {
		t.Fatal("Create não foi invocado")
	}
	if resp.Status != string(domain.StatusEmAndamento) {
		t.Errorf("response.status esperado EM_ANDAMENTO, got %s", resp.Status)
	}
	if resp.TreinoID != treinoID.String() {
		t.Errorf("response.treino_id esperado %s, got %s", treinoID, resp.TreinoID)
	}
}

func TestIniciarSessao_ChamadoDuasVezes_RetornaMesmaSessao(t *testing.T) {
	svc, sessoes, _, _, _ := newServiceForTest()

	alunoID := uuid.New()
	treinoID := uuid.New()
	sessaoExistente := &domain.SessaoTreino{
		ID:           uuid.New(),
		AlunoID:      alunoID,
		TreinoID:     treinoID,
		DataExecucao: time.Now().UTC().Truncate(24 * time.Hour),
		Status:       domain.StatusEmAndamento,
		IniciadoEm:   time.Now().UTC().Add(-30 * time.Minute),
	}

	sessoes.findEmAndamentoHojeFn = func(ctx context.Context, a, tid uuid.UUID) (*domain.SessaoTreino, error) {
		return sessaoExistente, nil
	}

	createCalled := false
	sessoes.createFn = func(ctx context.Context, s *domain.SessaoTreino) error {
		createCalled = true
		return nil
	}

	resp, err := svc.IniciarSessao(context.Background(), alunoID, IniciarSessaoRequest{
		TreinoID: treinoID.String(),
	})
	if err != nil {
		t.Fatalf("IniciarSessao: %v", err)
	}
	if createCalled {
		t.Error("Create não deveria ter sido invocado — sessão idempotente")
	}
	if resp.ID != sessaoExistente.ID.String() {
		t.Errorf("esperado retornar sessão pré-existente %s, got %s",
			sessaoExistente.ID, resp.ID)
	}
}

func TestIniciarSessao_TreinoForaDaFichaAtiva_RetornaErrTreinoInvalido(t *testing.T) {
	svc, _, _, treinos, _ := newServiceForTest()

	treinos.validarTreinoDoAlunoFn = func(ctx context.Context, a, tid uuid.UUID) (bool, error) {
		return false, nil
	}

	_, err := svc.IniciarSessao(context.Background(), uuid.New(), IniciarSessaoRequest{
		TreinoID: uuid.New().String(),
	})
	if !errors.Is(err, domain.ErrTreinoInvalido) {
		t.Fatalf("esperado ErrTreinoInvalido, got %v", err)
	}
}

// ── RegistrarSerie ────────────────────────────────────────────────────────

func TestRegistrarSerie_SessaoConcluida_RetornaErrSessaoJaConcluida(t *testing.T) {
	svc, sessoes, _, _, _ := newServiceForTest()

	alunoID := uuid.New()
	sessaoID := uuid.New()
	sessoes.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.SessaoTreino, error) {
		return &domain.SessaoTreino{
			ID:       id,
			AlunoID:  alunoID,
			TreinoID: uuid.New(),
			Status:   domain.StatusConcluido,
		}, nil
	}

	_, err := svc.RegistrarSerie(context.Background(), alunoID, sessaoID, RegistrarSerieRequest{
		ItemTreinoID: uuid.New().String(),
		NumeroSerie:  1,
	})
	if !errors.Is(err, domain.ErrSessaoJaConcluida) {
		t.Fatalf("esperado ErrSessaoJaConcluida, got %v", err)
	}
}

func TestRegistrarSerie_DeOutroAluno_RetornaErrSessaoForbidden(t *testing.T) {
	svc, sessoes, _, _, _ := newServiceForTest()

	dono := uuid.New()
	intruso := uuid.New()
	sessaoID := uuid.New()

	sessoes.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.SessaoTreino, error) {
		return &domain.SessaoTreino{ID: id, AlunoID: dono, Status: domain.StatusEmAndamento}, nil
	}

	_, err := svc.RegistrarSerie(context.Background(), intruso, sessaoID, RegistrarSerieRequest{
		ItemTreinoID: uuid.New().String(),
		NumeroSerie:  1,
	})
	if !errors.Is(err, domain.ErrSessaoForbidden) {
		t.Fatalf("esperado ErrSessaoForbidden, got %v", err)
	}
}

func TestRegistrarSerie_NumeroSerieAcimaDoLimite_RetornaErrSerieInvalida(t *testing.T) {
	svc, sessoes, _, treinos, _ := newServiceForTest()

	alunoID := uuid.New()
	sessaoID := uuid.New()
	treinoID := uuid.New()
	itemID := uuid.New()

	sessoes.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.SessaoTreino, error) {
		return &domain.SessaoTreino{
			ID:       id,
			AlunoID:  alunoID,
			TreinoID: treinoID,
			Status:   domain.StatusEmAndamento,
		}, nil
	}

	treinos.getTreinoComItensFn = func(ctx context.Context, tid uuid.UUID) (string, string, []domain.ItemBasico, error) {
		return "A", "Peito", []domain.ItemBasico{{ID: itemID, Series: 4}}, nil
	}

	_, err := svc.RegistrarSerie(context.Background(), alunoID, sessaoID, RegistrarSerieRequest{
		ItemTreinoID: itemID.String(),
		NumeroSerie:  5, // item tem 4 séries
	})
	if !errors.Is(err, domain.ErrSerieInvalida) {
		t.Fatalf("esperado ErrSerieInvalida, got %v", err)
	}
}

func TestRegistrarSerie_ConcluidaTrue_PreencheExecutadoEm(t *testing.T) {
	svc, sessoes, registros, treinos, _ := newServiceForTest()

	alunoID := uuid.New()
	sessaoID := uuid.New()
	treinoID := uuid.New()
	itemID := uuid.New()

	sessoes.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.SessaoTreino, error) {
		return &domain.SessaoTreino{
			ID:       id,
			AlunoID:  alunoID,
			TreinoID: treinoID,
			Status:   domain.StatusEmAndamento,
		}, nil
	}
	treinos.getTreinoComItensFn = func(ctx context.Context, tid uuid.UUID) (string, string, []domain.ItemBasico, error) {
		return "A", "", []domain.ItemBasico{{ID: itemID, Series: 4}}, nil
	}

	var captured *domain.RegistroSerie
	registros.upsertFn = func(ctx context.Context, r *domain.RegistroSerie) error {
		captured = r
		return nil
	}

	carga := 80.5
	reps := 10
	resp, err := svc.RegistrarSerie(context.Background(), alunoID, sessaoID, RegistrarSerieRequest{
		ItemTreinoID:         itemID.String(),
		NumeroSerie:          2,
		Concluida:            true,
		CargaRealizada:       &carga,
		RepeticoesRealizadas: &reps,
	})
	if err != nil {
		t.Fatalf("RegistrarSerie: %v", err)
	}
	if captured == nil {
		t.Fatal("Upsert não foi invocado")
	}
	if captured.ExecutadoEm == nil {
		t.Error("executado_em deveria ser preenchido quando concluida=true")
	}
	if !resp.Concluida {
		t.Error("response.concluida deveria ser true")
	}
}

func TestRegistrarSerie_ConcluidaFalse_DeixaExecutadoEmNulo(t *testing.T) {
	svc, sessoes, registros, treinos, _ := newServiceForTest()

	alunoID := uuid.New()
	sessaoID := uuid.New()
	treinoID := uuid.New()
	itemID := uuid.New()

	sessoes.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.SessaoTreino, error) {
		return &domain.SessaoTreino{
			ID: id, AlunoID: alunoID, TreinoID: treinoID,
			Status: domain.StatusEmAndamento,
		}, nil
	}
	treinos.getTreinoComItensFn = func(ctx context.Context, tid uuid.UUID) (string, string, []domain.ItemBasico, error) {
		return "A", "", []domain.ItemBasico{{ID: itemID, Series: 4}}, nil
	}

	var captured *domain.RegistroSerie
	registros.upsertFn = func(ctx context.Context, r *domain.RegistroSerie) error {
		captured = r
		return nil
	}

	_, err := svc.RegistrarSerie(context.Background(), alunoID, sessaoID, RegistrarSerieRequest{
		ItemTreinoID: itemID.String(),
		NumeroSerie:  1,
		Concluida:    false,
	})
	if err != nil {
		t.Fatalf("RegistrarSerie: %v", err)
	}
	if captured.ExecutadoEm != nil {
		t.Error("executado_em deveria permanecer nulo quando concluida=false")
	}
}

// ── ConcluirSessao ────────────────────────────────────────────────────────

func TestConcluirSessao_ChamadaDuasVezes_NaoErra(t *testing.T) {
	svc, sessoes, _, _, _ := newServiceForTest()

	alunoID := uuid.New()
	sessaoID := uuid.New()
	concluidaEm := time.Now().UTC().Add(-5 * time.Minute)

	// Estado simulado em memória — após o UpdateStatus, FindByID passa a
	// devolver a sessão CONCLUIDO. A 2ª chamada de ConcluirSessao detecta
	// e retorna sem chamar UpdateStatus de novo (idempotência).
	estado := domain.StatusEmAndamento
	sessoes.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.SessaoTreino, error) {
		s := &domain.SessaoTreino{ID: id, AlunoID: alunoID, Status: estado}
		if estado == domain.StatusConcluido {
			s.ConcluidoEm = &concluidaEm
		}
		return s, nil
	}

	updateChamado := 0
	sessoes.updateStatusFn = func(ctx context.Context, id uuid.UUID, st domain.StatusSessao, concluidoEm *time.Time) (bool, error) {
		updateChamado++
		if st != domain.StatusConcluido {
			t.Errorf("esperado UpdateStatus(CONCLUIDO), got %v", st)
		}
		estado = domain.StatusConcluido
		return true, nil
	}

	if _, err := svc.ConcluirSessao(context.Background(), alunoID, sessaoID); err != nil {
		t.Fatalf("ConcluirSessao 1: %v", err)
	}
	if _, err := svc.ConcluirSessao(context.Background(), alunoID, sessaoID); err != nil {
		t.Fatalf("ConcluirSessao 2 (idempotente): %v", err)
	}

	if updateChamado != 1 {
		t.Errorf("UpdateStatus deveria ser chamado 1x (idempotência), got %d", updateChamado)
	}
}

func TestConcluirSessao_ConclusaoFresca_NotificaPersonal(t *testing.T) {
	svc, sessoes, alunos, notifier := newServiceForNotifierTest()

	alunoID := uuid.New()
	sessaoID := uuid.New()
	personalID := uuid.New()

	estado := domain.StatusEmAndamento
	sessoes.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.SessaoTreino, error) {
		return &domain.SessaoTreino{ID: id, AlunoID: alunoID, Status: estado}, nil
	}
	sessoes.updateStatusFn = func(ctx context.Context, id uuid.UUID, st domain.StatusSessao, concluidoEm *time.Time) (bool, error) {
		estado = domain.StatusConcluido
		return true, nil
	}

	alunos.personalIDENomeFn = func(ctx context.Context, id uuid.UUID) (uuid.UUID, string, error) {
		if id != alunoID {
			t.Errorf("PersonalIDENome recebeu aluno errado: %v", id)
		}
		return personalID, "Maria Aluna", nil
	}

	var personalRecebido uuid.UUID
	var nomeRecebido string
	chamadas := 0
	notifier.notificarTreinoConcluidoFn = func(ctx context.Context, p uuid.UUID, nome string) error {
		chamadas++
		personalRecebido, nomeRecebido = p, nome
		return nil
	}

	if _, err := svc.ConcluirSessao(context.Background(), alunoID, sessaoID); err != nil {
		t.Fatalf("ConcluirSessao: %v", err)
	}

	if chamadas != 1 {
		t.Fatalf("NotificarTreinoConcluido deveria ser chamado 1x, got %d", chamadas)
	}
	if personalRecebido != personalID || nomeRecebido != "Maria Aluna" {
		t.Errorf("notificação com dados errados: personal=%v nome=%q", personalRecebido, nomeRecebido)
	}
}

func TestConcluirSessao_JaConcluida_NaoNotificaDeNovo(t *testing.T) {
	svc, sessoes, _, notifier := newServiceForNotifierTest()

	alunoID := uuid.New()
	sessaoID := uuid.New()
	concluidaEm := time.Now().UTC().Add(-time.Hour)

	sessoes.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.SessaoTreino, error) {
		return &domain.SessaoTreino{
			ID: id, AlunoID: alunoID, Status: domain.StatusConcluido, ConcluidoEm: &concluidaEm,
		}, nil
	}

	chamadas := 0
	notifier.notificarTreinoConcluidoFn = func(ctx context.Context, p uuid.UUID, nome string) error {
		chamadas++
		return nil
	}

	if _, err := svc.ConcluirSessao(context.Background(), alunoID, sessaoID); err != nil {
		t.Fatalf("ConcluirSessao: %v", err)
	}
	if chamadas != 0 {
		t.Errorf("sessão já concluída não deveria disparar notificação de novo, got %d chamadas", chamadas)
	}
}

// TestConcluirSessao_PerdeARaceDeConclusao_NaoNotifica cobre o achado de
// code-review: numa corrida entre duas requisições concluindo a mesma
// sessão (ex: duplo tap), ambas leem EM_ANDAMENTO antes de qualquer commit,
// então nenhuma cai no early-return de idempotência — a diferenciação só
// acontece dentro de UpdateStatus (WHERE status='EM_ANDAMENTO'), que devolve
// transicionou=false pra quem perde a corrida. Simula exatamente essa
// resposta (nil error, transicionou=false) e confirma que só quem realmente
// transicionou notifica.
func TestConcluirSessao_PerdeARaceDeConclusao_NaoNotifica(t *testing.T) {
	svc, sessoes, _, notifier := newServiceForNotifierTest()

	alunoID := uuid.New()
	sessaoID := uuid.New()

	sessoes.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.SessaoTreino, error) {
		return &domain.SessaoTreino{ID: id, AlunoID: alunoID, Status: domain.StatusEmAndamento}, nil
	}
	sessoes.updateStatusFn = func(ctx context.Context, id uuid.UUID, st domain.StatusSessao, concluidoEm *time.Time) (bool, error) {
		// Simula ter perdido a corrida: outra requisição já concluiu a
		// sessão entre o FindByID e este UpdateStatus.
		return false, nil
	}

	chamadas := 0
	notifier.notificarTreinoConcluidoFn = func(ctx context.Context, p uuid.UUID, nome string) error {
		chamadas++
		return nil
	}

	if _, err := svc.ConcluirSessao(context.Background(), alunoID, sessaoID); err != nil {
		t.Fatalf("ConcluirSessao: %v", err)
	}
	if chamadas != 0 {
		t.Errorf("quem perde a corrida de conclusão não deveria notificar, got %d chamadas", chamadas)
	}
}

func TestConcluirSessao_FalhaAoNotificar_NaoQuebraConclusao(t *testing.T) {
	svc, sessoes, alunos, notifier := newServiceForNotifierTest()

	alunoID := uuid.New()
	sessaoID := uuid.New()

	sessoes.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.SessaoTreino, error) {
		return &domain.SessaoTreino{ID: id, AlunoID: alunoID, Status: domain.StatusEmAndamento}, nil
	}
	alunos.personalIDENomeFn = func(ctx context.Context, id uuid.UUID) (uuid.UUID, string, error) {
		return uuid.Nil, "", errors.New("lookup indisponível")
	}
	notifier.notificarTreinoConcluidoFn = func(ctx context.Context, p uuid.UUID, nome string) error {
		t.Error("NotificarTreinoConcluido não deveria ser chamado quando o lookup do personal falha")
		return nil
	}

	resp, err := svc.ConcluirSessao(context.Background(), alunoID, sessaoID)
	if err != nil {
		t.Fatalf("ConcluirSessao não deveria falhar por causa de erro na notificação: %v", err)
	}
	if resp == nil {
		t.Fatal("resposta não deveria ser nil")
	}
}

// ── ListarSessoesDoAluno ──────────────────────────────────────────────────

func TestListarSessoesDoAluno_AlunoDeOutroPersonal_RetornaForbidden(t *testing.T) {
	svc, _, _, _, alunos := newServiceForTest()

	personalA := uuid.New()
	alunoB := uuid.New()

	chamou := false
	alunos.belongsFn = func(ctx context.Context, a, p uuid.UUID) (bool, error) {
		chamou = true
		if a != alunoB || p != personalA {
			t.Errorf("BelongsToPersonal: argumentos errados (%v, %v)", a, p)
		}
		return false, nil
	}

	_, err := svc.ListarSessoesDoAluno(context.Background(), personalA, alunoB, 1, 20)
	if !chamou {
		t.Error("BelongsToPersonal deveria ter sido chamado antes de listar")
	}
	if !errors.Is(err, domain.ErrSessaoForbidden) {
		t.Fatalf("esperado ErrSessaoForbidden, got %v", err)
	}
}

func TestListarSessoesDoAluno_AlunoValido_RepassaPaginacao(t *testing.T) {
	svc, sessoes, _, _, alunos := newServiceForTest()

	personalID := uuid.New()
	alunoID := uuid.New()

	alunos.belongsFn = func(ctx context.Context, a, p uuid.UUID) (bool, error) {
		return true, nil
	}

	var capPage, capPerPage int
	sessoes.listByAlunoFn = func(ctx context.Context, a uuid.UUID, page, perPage int) ([]*domain.SessaoComResumo, int, error) {
		capPage = page
		capPerPage = perPage
		return []*domain.SessaoComResumo{
			{
				SessaoTreino: domain.SessaoTreino{
					ID:           uuid.New(),
					AlunoID:      alunoID,
					TreinoID:     uuid.New(),
					DataExecucao: time.Now().UTC(),
					Status:       domain.StatusConcluido,
					IniciadoEm:   time.Now().UTC(),
				},
				TreinoLetra:      "A",
				TreinoNome:       "Peito/Tríceps",
				TotalSeries:      12,
				SeriesConcluidas: 12,
			},
		}, 1, nil
	}

	resp, err := svc.ListarSessoesDoAluno(context.Background(), personalID, alunoID, 2, 50)
	if err != nil {
		t.Fatalf("ListarSessoesDoAluno: %v", err)
	}
	if capPage != 2 || capPerPage != 50 {
		t.Errorf("paginação repassada incorretamente: page=%d, per_page=%d", capPage, capPerPage)
	}
	if resp.Pagination.Total != 1 {
		t.Errorf("total esperado 1, got %d", resp.Pagination.Total)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("esperado 1 sessão, got %d", len(resp.Data))
	}
	if resp.Data[0].TreinoLetra != "A" {
		t.Errorf("treino_letra esperado A, got %s", resp.Data[0].TreinoLetra)
	}
}
