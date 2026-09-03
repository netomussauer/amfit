package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/amfit/api/internal/training/domain"
	"github.com/google/uuid"
)

// newServiceForTest devolve um TrainingService com mocks injetados, expostos
// para configuração caso a caso.
func newServiceForTest() (
	*TrainingService,
	*mockFichaRepo,
	*mockTreinoRepo,
	*mockItemRepo,
	*mockFichaCompletaRepo,
	*mockTreinoHojeRepo,
	*mockAlunoLookup,
) {
	fichas := &mockFichaRepo{}
	treinos := &mockTreinoRepo{}
	itens := &mockItemRepo{}
	fichaCompleta := &mockFichaCompletaRepo{}
	treinoHoje := &mockTreinoHojeRepo{}
	alunos := &mockAlunoLookup{}

	svc := NewTrainingService(fichas, treinos, itens, fichaCompleta, treinoHoje, alunos, &mockTemplateTreinoRepo{})
	return svc, fichas, treinos, itens, fichaCompleta, treinoHoje, alunos
}

// newTemplateServiceForTest expõe também o mock de TemplateTreinoRepository e
// o de AlunoLookup — testes de ListarTemplates/CriarFichaFromTemplate usam
// este helper em vez do newServiceForTest genérico.
func newTemplateServiceForTest() (
	*TrainingService,
	*mockTemplateTreinoRepo,
	*mockAlunoLookup,
) {
	alunos := &mockAlunoLookup{}
	templates := &mockTemplateTreinoRepo{}

	svc := NewTrainingService(
		&mockFichaRepo{}, &mockTreinoRepo{}, &mockItemRepo{},
		&mockFichaCompletaRepo{}, &mockTreinoHojeRepo{}, alunos, templates,
	)
	return svc, templates, alunos
}

// ── CriarFicha ────────────────────────────────────────────────────────────

func TestCriarFicha_AlunoDeOutroPersonal_RetornaForbidden(t *testing.T) {
	svc, _, _, _, _, _, alunos := newServiceForTest()

	personalA := uuid.New()
	alunoB := uuid.New()

	alunos.belongsFn = func(ctx context.Context, alunoID, personalID uuid.UUID) (bool, error) {
		if alunoID != alunoB || personalID != personalA {
			t.Errorf("BelongsToPersonal recebeu (%v, %v), esperava (%v, %v)",
				alunoID, personalID, alunoB, personalA)
		}
		return false, nil
	}

	_, err := svc.CriarFicha(context.Background(), personalA, CriarFichaRequest{
		AlunoID:        alunoB.String(),
		Nome:           "Hipertrofia",
		VigenciaInicio: "2026-05-01",
	})
	if !errors.Is(err, domain.ErrFichaForbidden) {
		t.Fatalf("esperado ErrFichaForbidden, got %v", err)
	}
}

func TestCriarFicha_AlunoDoPersonal_Sucesso(t *testing.T) {
	svc, fichas, _, _, _, _, _ := newServiceForTest()

	personalID := uuid.New()
	alunoID := uuid.New()

	created := false
	fichas.createFn = func(ctx context.Context, f *domain.FichaTreino) error {
		created = true
		if f.PersonalID != personalID {
			t.Errorf("personal_id esperado %v, got %v", personalID, f.PersonalID)
		}
		if f.AlunoID != alunoID {
			t.Errorf("aluno_id esperado %v, got %v", alunoID, f.AlunoID)
		}
		if !f.Ativa {
			t.Error("ficha deveria nascer ativa")
		}
		return nil
	}

	resp, err := svc.CriarFicha(context.Background(), personalID, CriarFichaRequest{
		AlunoID:        alunoID.String(),
		Nome:           "Hipertrofia",
		VigenciaInicio: "2026-05-01",
		VigenciaFim:    "2026-08-01",
	})
	if err != nil {
		t.Fatalf("CriarFicha: %v", err)
	}
	if !created {
		t.Fatal("Create não foi invocado")
	}
	if resp.AlunoID != alunoID.String() {
		t.Errorf("response.aluno_id esperado %s, got %s", alunoID, resp.AlunoID)
	}
	if resp.VigenciaFim == nil || *resp.VigenciaFim != "2026-08-01" {
		t.Errorf("vigencia_fim incorreta: %v", resp.VigenciaFim)
	}
}

// ── CriarTreino ───────────────────────────────────────────────────────────

func TestCriarTreino_LetraDuplicada_RetornaErrLetraJaUsada(t *testing.T) {
	svc, fichas, treinos, _, _, _, _ := newServiceForTest()

	personalID := uuid.New()
	fichaID := uuid.New()

	fichas.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.FichaTreino, error) {
		return &domain.FichaTreino{
			ID:             id,
			AlunoID:        uuid.New(),
			PersonalID:     personalID,
			Nome:           "Hipertrofia",
			VigenciaInicio: time.Now(),
			Ativa:          true,
		}, nil
	}

	treinos.createFn = func(ctx context.Context, t *domain.Treino) error {
		return domain.ErrLetraJaUsada
	}

	_, err := svc.CriarTreino(context.Background(), personalID, fichaID, CriarTreinoRequest{
		Letra: "A",
		Nome:  "Peito/Tríceps",
	})
	if !errors.Is(err, domain.ErrLetraJaUsada) {
		t.Fatalf("esperado ErrLetraJaUsada, got %v", err)
	}
}

func TestCriarTreino_FichaDeOutroPersonal_RetornaForbidden(t *testing.T) {
	svc, fichas, _, _, _, _, _ := newServiceForTest()

	dono := uuid.New()
	intruso := uuid.New()
	fichaID := uuid.New()

	fichas.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.FichaTreino, error) {
		return &domain.FichaTreino{
			ID:         id,
			AlunoID:    uuid.New(),
			PersonalID: dono,
			Nome:       "Hipertrofia",
		}, nil
	}

	_, err := svc.CriarTreino(context.Background(), intruso, fichaID, CriarTreinoRequest{
		Letra: "A",
	})
	if !errors.Is(err, domain.ErrFichaForbidden) {
		t.Fatalf("esperado ErrFichaForbidden, got %v", err)
	}
}

// ── BuscarFicha (read-model completo) ─────────────────────────────────────

func TestBuscarFicha_RetornaEstruturaCompleta(t *testing.T) {
	svc, fichas, _, _, fichaCompleta, _, _ := newServiceForTest()

	personalID := uuid.New()
	fichaID := uuid.New()

	ficha := domain.FichaTreino{
		ID:             fichaID,
		AlunoID:        uuid.New(),
		PersonalID:     personalID,
		Nome:           "Hipertrofia",
		VigenciaInicio: time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC),
		Ativa:          true,
	}

	fichas.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.FichaTreino, error) {
		return &ficha, nil
	}

	treinoIDs := []uuid.UUID{uuid.New(), uuid.New(), uuid.New()}
	fichaCompleta.getCompletaFn = func(ctx context.Context, fid uuid.UUID) (*domain.FichaCompleta, error) {
		return &domain.FichaCompleta{
			Ficha: ficha,
			Treinos: []domain.TreinoCompleto{
				{
					Treino: domain.Treino{ID: treinoIDs[0], FichaID: fichaID, Letra: "A", Ordem: 0},
					Itens: []domain.ItemTreinoComExercicio{
						{ItemTreino: domain.ItemTreino{ID: uuid.New(), Series: 4, Repeticoes: "8-12"}, ExercicioNome: "Supino"},
						{ItemTreino: domain.ItemTreino{ID: uuid.New(), Series: 3, Repeticoes: "10"}, ExercicioNome: "Crucifixo"},
					},
				},
				{
					Treino: domain.Treino{ID: treinoIDs[1], FichaID: fichaID, Letra: "B", Ordem: 1},
					Itens:  []domain.ItemTreinoComExercicio{},
				},
				{
					Treino: domain.Treino{ID: treinoIDs[2], FichaID: fichaID, Letra: "C", Ordem: 2},
					Itens: []domain.ItemTreinoComExercicio{
						{ItemTreino: domain.ItemTreino{ID: uuid.New(), Series: 5, Repeticoes: "5"}, ExercicioNome: "Agachamento"},
					},
				},
			},
		}, nil
	}

	resp, err := svc.BuscarFicha(context.Background(), personalID, fichaID)
	if err != nil {
		t.Fatalf("BuscarFicha: %v", err)
	}
	if len(resp.Treinos) != 3 {
		t.Fatalf("esperado 3 treinos, got %d", len(resp.Treinos))
	}
	if len(resp.Treinos[0].Itens) != 2 {
		t.Errorf("treino A esperado 2 itens, got %d", len(resp.Treinos[0].Itens))
	}
	if len(resp.Treinos[2].Itens) != 1 {
		t.Errorf("treino C esperado 1 item, got %d", len(resp.Treinos[2].Itens))
	}
}

func TestBuscarFicha_DeOutroPersonal_RetornaForbidden(t *testing.T) {
	svc, fichas, _, _, _, _, _ := newServiceForTest()

	dono := uuid.New()
	intruso := uuid.New()
	fichaID := uuid.New()

	fichas.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.FichaTreino, error) {
		return &domain.FichaTreino{ID: id, PersonalID: dono}, nil
	}

	_, err := svc.BuscarFicha(context.Background(), intruso, fichaID)
	if !errors.Is(err, domain.ErrFichaForbidden) {
		t.Fatalf("esperado ErrFichaForbidden, got %v", err)
	}
}

// ── ReordenarItens ────────────────────────────────────────────────────────

func TestReordenarItens_PropagaIDsNaOrdem(t *testing.T) {
	svc, fichas, treinos, itens, _, _, _ := newServiceForTest()

	personalID := uuid.New()
	fichaID := uuid.New()
	treinoID := uuid.New()

	fichas.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.FichaTreino, error) {
		return &domain.FichaTreino{ID: id, PersonalID: personalID}, nil
	}
	treinos.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.Treino, error) {
		return &domain.Treino{ID: id, FichaID: fichaID}, nil
	}

	novosIDs := []uuid.UUID{uuid.New(), uuid.New(), uuid.New()}

	called := false
	itens.reorderFn = func(ctx context.Context, tid uuid.UUID, ids []uuid.UUID) error {
		called = true
		if tid != treinoID {
			t.Errorf("treino_id esperado %v, got %v", treinoID, tid)
		}
		if len(ids) != 3 {
			t.Fatalf("esperado 3 ids, got %d", len(ids))
		}
		for i, id := range ids {
			if id != novosIDs[i] {
				t.Errorf("id na posição %d: esperado %v, got %v", i, novosIDs[i], id)
			}
		}
		return nil
	}

	req := ReordenarItensRequest{IDs: []string{
		novosIDs[0].String(), novosIDs[1].String(), novosIDs[2].String(),
	}}

	if err := svc.ReordenarItens(context.Background(), personalID, treinoID, req); err != nil {
		t.Fatalf("ReordenarItens: %v", err)
	}
	if !called {
		t.Fatal("Reorder não foi invocado")
	}
}

func TestReordenarItens_TreinoDeOutroPersonal_RetornaForbidden(t *testing.T) {
	svc, fichas, treinos, _, _, _, _ := newServiceForTest()

	dono := uuid.New()
	intruso := uuid.New()
	fichaID := uuid.New()

	treinos.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.Treino, error) {
		return &domain.Treino{ID: id, FichaID: fichaID}, nil
	}
	fichas.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.FichaTreino, error) {
		return &domain.FichaTreino{ID: id, PersonalID: dono}, nil
	}

	err := svc.ReordenarItens(context.Background(), intruso, uuid.New(), ReordenarItensRequest{
		IDs: []string{uuid.New().String()},
	})
	if !errors.Is(err, domain.ErrTreinoForbidden) {
		t.Fatalf("esperado ErrTreinoForbidden, got %v", err)
	}
}

// ── ObterTreinoHoje ───────────────────────────────────────────────────────

func TestObterTreinoHoje_SemFichaAtiva_RetornaErrSemFichaAtiva(t *testing.T) {
	svc, _, _, _, _, treinoHoje, _ := newServiceForTest()

	treinoHoje.getTreinoHojeFn = func(ctx context.Context, alunoID uuid.UUID) (*domain.TreinoCompleto, error) {
		return nil, domain.ErrSemFichaAtiva
	}

	_, err := svc.ObterTreinoHoje(context.Background(), uuid.New())
	if !errors.Is(err, domain.ErrSemFichaAtiva) {
		t.Fatalf("esperado ErrSemFichaAtiva, got %v", err)
	}
}

func TestObterTreinoHoje_FichaSemTreinos_RetornaErrSemTreinoHoje(t *testing.T) {
	svc, _, _, _, _, treinoHoje, _ := newServiceForTest()

	treinoHoje.getTreinoHojeFn = func(ctx context.Context, alunoID uuid.UUID) (*domain.TreinoCompleto, error) {
		return nil, domain.ErrSemTreinoHoje
	}

	_, err := svc.ObterTreinoHoje(context.Background(), uuid.New())
	if !errors.Is(err, domain.ErrSemTreinoHoje) {
		t.Fatalf("esperado ErrSemTreinoHoje, got %v", err)
	}
}

func TestObterTreinoHoje_SemSessaoAnterior_RetornaTreinoA(t *testing.T) {
	svc, _, _, _, _, treinoHoje, _ := newServiceForTest()

	treinoA := domain.TreinoCompleto{
		Treino: domain.Treino{
			ID:    uuid.New(),
			Letra: "A",
			Nome:  "Peito/Tríceps",
			Ordem: 0,
		},
		Itens: []domain.ItemTreinoComExercicio{
			{ItemTreino: domain.ItemTreino{ID: uuid.New(), Series: 4, Repeticoes: "8-12"}, ExercicioNome: "Supino"},
		},
	}

	treinoHoje.getTreinoHojeFn = func(ctx context.Context, alunoID uuid.UUID) (*domain.TreinoCompleto, error) {
		// Sem sessões anteriores → repository devolve o primeiro treino.
		return &treinoA, nil
	}

	resp, err := svc.ObterTreinoHoje(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("ObterTreinoHoje: %v", err)
	}
	if resp.Treino == nil {
		t.Fatal("treino esperado, got nil")
	}
	if resp.Treino.Letra != "A" {
		t.Errorf("esperado letra A, got %s", resp.Treino.Letra)
	}
	if resp.SessaoHojeID != nil {
		t.Errorf("sessao_hoje_id deveria ser nil na fatia atual, got %v", resp.SessaoHojeID)
	}
}

func TestObterTreinoHoje_AposSessaoA_RetornaTreinoB(t *testing.T) {
	svc, _, _, _, _, treinoHoje, _ := newServiceForTest()

	// O service só repassa o que vem do repositório. Esse teste documenta
	// o contrato: quando o repository indica B, a resposta é B.
	treinoB := domain.TreinoCompleto{
		Treino: domain.Treino{ID: uuid.New(), Letra: "B", Ordem: 1},
	}

	treinoHoje.getTreinoHojeFn = func(ctx context.Context, alunoID uuid.UUID) (*domain.TreinoCompleto, error) {
		return &treinoB, nil
	}

	resp, err := svc.ObterTreinoHoje(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("ObterTreinoHoje: %v", err)
	}
	if resp.Treino.Letra != "B" {
		t.Errorf("esperado letra B, got %s", resp.Treino.Letra)
	}
}

func TestObterTreinoHoje_AposSessaoC_RotacionaParaA(t *testing.T) {
	svc, _, _, _, _, treinoHoje, _ := newServiceForTest()

	// Após terminar C, a regra do repository é voltar para A.
	treinoA := domain.TreinoCompleto{
		Treino: domain.Treino{ID: uuid.New(), Letra: "A", Ordem: 0},
	}

	treinoHoje.getTreinoHojeFn = func(ctx context.Context, alunoID uuid.UUID) (*domain.TreinoCompleto, error) {
		return &treinoA, nil
	}

	resp, err := svc.ObterTreinoHoje(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("ObterTreinoHoje: %v", err)
	}
	if resp.Treino.Letra != "A" {
		t.Errorf("após sessão C esperado rotação para A, got %s", resp.Treino.Letra)
	}
}

// ── DesativarFicha ────────────────────────────────────────────────────────

func TestDesativarFicha_JaInativa_NaoChamaDeactivate(t *testing.T) {
	svc, fichas, _, _, _, _, _ := newServiceForTest()

	personalID := uuid.New()
	fichaID := uuid.New()

	fichas.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.FichaTreino, error) {
		return &domain.FichaTreino{ID: id, PersonalID: personalID, Ativa: false}, nil
	}
	called := false
	fichas.deactivateFn = func(ctx context.Context, id uuid.UUID) error {
		called = true
		return nil
	}

	if err := svc.DesativarFicha(context.Background(), personalID, fichaID); err != nil {
		t.Fatalf("DesativarFicha: %v", err)
	}
	if called {
		t.Error("Deactivate não deveria ser chamado para ficha já inativa")
	}
}

// ── AtualizarItem ─────────────────────────────────────────────────────────

func TestAtualizarItemTreino_AplicaPatchParcial(t *testing.T) {
	svc, fichas, treinos, itens, _, _, _ := newServiceForTest()

	personalID := uuid.New()
	fichaID := uuid.New()
	treinoID := uuid.New()
	itemID := uuid.New()

	fichas.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.FichaTreino, error) {
		return &domain.FichaTreino{ID: id, PersonalID: personalID}, nil
	}
	treinos.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.Treino, error) {
		return &domain.Treino{ID: id, FichaID: fichaID}, nil
	}
	itens.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.ItemTreino, error) {
		return &domain.ItemTreino{
			ID:         id,
			TreinoID:   treinoID,
			Series:     3,
			Repeticoes: "10",
		}, nil
	}

	updated := false
	itens.updateFn = func(ctx context.Context, i *domain.ItemTreino) error {
		updated = true
		if i.Series != 5 {
			t.Errorf("series esperado 5, got %d", i.Series)
		}
		// Repeticoes não foi enviado no patch — deve manter o valor original.
		if i.Repeticoes != "10" {
			t.Errorf("repeticoes deveria preservar '10', got %s", i.Repeticoes)
		}
		return nil
	}

	novasSeries := 5
	_, err := svc.AtualizarItemTreino(context.Background(), personalID, itemID, AtualizarItemTreinoRequest{
		Series: &novasSeries,
	})
	if err != nil {
		t.Fatalf("AtualizarItemTreino: %v", err)
	}
	if !updated {
		t.Fatal("Update não foi invocado")
	}
}
