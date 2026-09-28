package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/amfit/api/internal/training/domain"
	"github.com/google/uuid"
)

// ── ListarTemplates ───────────────────────────────────────────────────────

func TestListarTemplates_RepassaFiltrosEDevolveDTO(t *testing.T) {
	svc, templates, _ := newTemplateServiceForTest()

	personalID := uuid.New()
	nivel := "INICIANTE"
	objetivo := "hipertrofia"

	templateID := uuid.New()
	exercicioID := uuid.New()
	var filtroRecebido domain.ListTemplatesFilter
	templates.listFn = func(ctx context.Context, filter domain.ListTemplatesFilter) ([]domain.TemplateComItens, error) {
		filtroRecebido = filter
		return []domain.TemplateComItens{
			{
				Template: domain.TemplateTreino{ID: templateID, Nome: "Full Body", Nivel: "INICIANTE", Objetivo: "hipertrofia", CriadoPor: domain.OrigemTemplateSistema},
				Itens: []domain.TemplateItem{
					{ID: uuid.New(), TemplateID: templateID, ExercicioID: exercicioID, TreinoLetra: "A", Ordem: 0, Series: 3, Repeticoes: "10-12"},
				},
			},
		}, nil
	}

	resp, err := svc.ListarTemplates(context.Background(), personalID, &nivel, &objetivo)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if filtroRecebido.PersonalID != personalID || *filtroRecebido.Nivel != nivel || *filtroRecebido.Objetivo != objetivo {
		t.Errorf("filtro repassado incorretamente: %+v", filtroRecebido)
	}
	if len(resp.Data) != 1 || resp.Data[0].ID != templateID.String() {
		t.Fatalf("resposta inesperada: %+v", resp)
	}
	if len(resp.Data[0].Itens) != 1 || resp.Data[0].Itens[0].TreinoLetra != "A" {
		t.Errorf("itens do template mapeados incorretamente: %+v", resp.Data[0].Itens)
	}
}

// ── CriarFichaFromTemplate ────────────────────────────────────────────────

func TestCriarFichaFromTemplate_AlunoDeOutroPersonal_NaoAplicaTemplate(t *testing.T) {
	svc, templates, alunos := newTemplateServiceForTest()

	alunos.belongsFn = func(ctx context.Context, alunoID, personalID uuid.UUID) (bool, error) {
		return false, nil
	}
	chamou := false
	templates.aplicarTemplateFn = func(
		ctx context.Context, templateID, alunoID, personalID uuid.UUID, nome string, vigenciaInicio time.Time,
	) (*domain.FichaCompleta, error) {
		chamou = true
		return nil, nil
	}

	_, err := svc.CriarFichaFromTemplate(context.Background(), uuid.New(), CriarFichaFromTemplateRequest{
		TemplateID: uuid.New().String(), AlunoID: uuid.New().String(), VigenciaInicio: "2026-01-01",
	})
	if !errors.Is(err, domain.ErrFichaForbidden) {
		t.Fatalf("esperado ErrFichaForbidden, got %v", err)
	}
	if chamou {
		t.Error("AplicarTemplate nao deveria ter sido chamado — ownership falhou antes")
	}
}

func TestCriarFichaFromTemplate_TemplateNaoEncontrado_PropagaErro(t *testing.T) {
	svc, templates, _ := newTemplateServiceForTest()

	templates.aplicarTemplateFn = func(
		ctx context.Context, templateID, alunoID, personalID uuid.UUID, nome string, vigenciaInicio time.Time,
	) (*domain.FichaCompleta, error) {
		return nil, domain.ErrTemplateNotFound
	}

	_, err := svc.CriarFichaFromTemplate(context.Background(), uuid.New(), CriarFichaFromTemplateRequest{
		TemplateID: uuid.New().String(), AlunoID: uuid.New().String(), VigenciaInicio: "2026-01-01",
	})
	if !errors.Is(err, domain.ErrTemplateNotFound) {
		t.Fatalf("esperado ErrTemplateNotFound, got %v", err)
	}
}

func TestCriarFichaFromTemplate_CaminhoFeliz_RepassaParametrosEMapeiaResposta(t *testing.T) {
	svc, templates, alunos := newTemplateServiceForTest()

	personalID := uuid.New()
	alunoID := uuid.New()
	templateID := uuid.New()
	fichaID := uuid.New()

	alunos.belongsFn = func(ctx context.Context, a, p uuid.UUID) (bool, error) {
		if a != alunoID || p != personalID {
			t.Errorf("BelongsToPersonal recebeu (%v, %v)", a, p)
		}
		return true, nil
	}

	var templateIDRecebido, alunoIDRecebido, personalIDRecebido uuid.UUID
	var nomeRecebido string
	var vigenciaRecebida time.Time
	templates.aplicarTemplateFn = func(
		ctx context.Context, tID, aID, pID uuid.UUID, nome string, vigenciaInicio time.Time,
	) (*domain.FichaCompleta, error) {
		templateIDRecebido, alunoIDRecebido, personalIDRecebido = tID, aID, pID
		nomeRecebido, vigenciaRecebida = nome, vigenciaInicio
		return &domain.FichaCompleta{
			Ficha: domain.FichaTreino{ID: fichaID, AlunoID: alunoID, PersonalID: personalID, Nome: "Full Body Iniciante", VigenciaInicio: vigenciaInicio, Ativa: true},
		}, nil
	}

	resp, err := svc.CriarFichaFromTemplate(context.Background(), personalID, CriarFichaFromTemplateRequest{
		TemplateID:     templateID.String(),
		AlunoID:        alunoID.String(),
		VigenciaInicio: "2026-01-15",
	})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if templateIDRecebido != templateID || alunoIDRecebido != alunoID || personalIDRecebido != personalID {
		t.Errorf("AplicarTemplate recebeu IDs errados: template=%v aluno=%v personal=%v", templateIDRecebido, alunoIDRecebido, personalIDRecebido)
	}
	if nomeRecebido != "" {
		t.Errorf("nome deveria ficar vazio (sem override) quando request nao informa, got %q", nomeRecebido)
	}
	if !vigenciaRecebida.Equal(time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)) {
		t.Errorf("vigencia_inicio parseada incorretamente: %v", vigenciaRecebida)
	}
	if resp.ID != fichaID.String() || resp.Nome != "Full Body Iniciante" {
		t.Errorf("resposta mapeada incorretamente: %+v", resp)
	}
}

// ── SalvarFichaComoTemplate ─────────────────────────────────────────────────

// newSalvarComoTemplateServiceForTest expõe fichas e templates — os dois
// mocks que SalvarFichaComoTemplate usa (ownership + escrita), diferente de
// newTemplateServiceForTest (só leitura de templates).
func newSalvarComoTemplateServiceForTest() (*TrainingService, *mockFichaRepo, *mockTemplateTreinoRepo) {
	fichas := &mockFichaRepo{}
	templates := &mockTemplateTreinoRepo{}
	svc := NewTrainingService(
		fichas, &mockTreinoRepo{}, &mockItemRepo{},
		&mockFichaCompletaRepo{}, &mockTreinoHojeRepo{}, &mockAlunoLookup{}, templates,
		&mockSessaoHojeLookup{},
	)
	return svc, fichas, templates
}

func TestSalvarFichaComoTemplate_FichaDeOutroPersonal_DevolveForbidden(t *testing.T) {
	svc, fichas, templates := newSalvarComoTemplateServiceForTest()
	outroPersonalID := uuid.New()
	fichas.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.FichaTreino, error) {
		return &domain.FichaTreino{ID: id, PersonalID: outroPersonalID}, nil
	}
	chamou := false
	templates.criarFromFichaFn = func(
		ctx context.Context, fichaID, personalID uuid.UUID, nome, nivel, objetivo string,
	) (domain.TemplateComItens, error) {
		chamou = true
		return domain.TemplateComItens{}, nil
	}

	_, err := svc.SalvarFichaComoTemplate(context.Background(), uuid.New(), uuid.New(), SalvarFichaComoTemplateRequest{
		Nome: "Full Body", Nivel: "INICIANTE", Objetivo: "hipertrofia",
	})
	if !errors.Is(err, domain.ErrFichaForbidden) {
		t.Fatalf("esperado ErrFichaForbidden, got %v", err)
	}
	if chamou {
		t.Error("CriarFromFicha nao deveria ter sido chamado — ownership falhou antes")
	}
}

func TestSalvarFichaComoTemplate_FichaNaoEncontrada_PropagaErro(t *testing.T) {
	svc, fichas, _ := newSalvarComoTemplateServiceForTest()
	fichas.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.FichaTreino, error) {
		return nil, domain.ErrFichaNotFound
	}

	_, err := svc.SalvarFichaComoTemplate(context.Background(), uuid.New(), uuid.New(), SalvarFichaComoTemplateRequest{
		Nome: "Full Body", Nivel: "INICIANTE", Objetivo: "hipertrofia",
	})
	if !errors.Is(err, domain.ErrFichaNotFound) {
		t.Fatalf("esperado ErrFichaNotFound, got %v", err)
	}
}

func TestSalvarFichaComoTemplate_NomeSoComEspacos_DevolveErroSemChamarRepositorio(t *testing.T) {
	personalID := uuid.New()
	svc, fichas, templates := newSalvarComoTemplateServiceForTest()
	fichas.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.FichaTreino, error) {
		return &domain.FichaTreino{ID: id, PersonalID: personalID}, nil
	}
	chamou := false
	templates.criarFromFichaFn = func(
		ctx context.Context, fichaID, pID uuid.UUID, nome, nivel, objetivo string,
	) (domain.TemplateComItens, error) {
		chamou = true
		return domain.TemplateComItens{}, nil
	}

	_, err := svc.SalvarFichaComoTemplate(context.Background(), personalID, uuid.New(), SalvarFichaComoTemplateRequest{
		Nome: "   ", Nivel: "INICIANTE", Objetivo: "hipertrofia",
	})
	if !errors.Is(err, domain.ErrNomeTemplateObrigatorio) {
		t.Fatalf("esperado ErrNomeTemplateObrigatorio, got %v", err)
	}
	if chamou {
		t.Error("CriarFromFicha nao deveria ter sido chamado — nome vazio apos trim")
	}
}

func TestSalvarFichaComoTemplate_FichaSemItens_PropagaErro(t *testing.T) {
	personalID := uuid.New()
	svc, fichas, templates := newSalvarComoTemplateServiceForTest()
	fichas.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.FichaTreino, error) {
		return &domain.FichaTreino{ID: id, PersonalID: personalID}, nil
	}
	templates.criarFromFichaFn = func(
		ctx context.Context, fichaID, pID uuid.UUID, nome, nivel, objetivo string,
	) (domain.TemplateComItens, error) {
		return domain.TemplateComItens{}, domain.ErrFichaSemItens
	}

	_, err := svc.SalvarFichaComoTemplate(context.Background(), personalID, uuid.New(), SalvarFichaComoTemplateRequest{
		Nome: "Full Body", Nivel: "INICIANTE", Objetivo: "hipertrofia",
	})
	if !errors.Is(err, domain.ErrFichaSemItens) {
		t.Fatalf("esperado ErrFichaSemItens, got %v", err)
	}
}

func TestSalvarFichaComoTemplate_CaminhoFeliz_RepassaParametrosEMapeiaResposta(t *testing.T) {
	personalID := uuid.New()
	fichaID := uuid.New()
	templateID := uuid.New()
	exercicioID := uuid.New()

	svc, fichas, templates := newSalvarComoTemplateServiceForTest()
	fichas.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.FichaTreino, error) {
		return &domain.FichaTreino{ID: id, PersonalID: personalID}, nil
	}

	var fichaIDRecebido, personalIDRecebido uuid.UUID
	var nomeRecebido, nivelRecebido, objetivoRecebido string
	templates.criarFromFichaFn = func(
		ctx context.Context, fID, pID uuid.UUID, nome, nivel, objetivo string,
	) (domain.TemplateComItens, error) {
		fichaIDRecebido, personalIDRecebido = fID, pID
		nomeRecebido, nivelRecebido, objetivoRecebido = nome, nivel, objetivo
		return domain.TemplateComItens{
			Template: domain.TemplateTreino{
				ID: templateID, Nome: nome, Nivel: nivel, Objetivo: objetivo,
				CriadoPor: domain.OrigemTemplatePersonal, PersonalID: &pID, Ativo: true,
			},
			Itens: []domain.TemplateItem{
				{ID: uuid.New(), TemplateID: templateID, ExercicioID: exercicioID, TreinoLetra: "A", Ordem: 0, Series: 3, Repeticoes: "10-12"},
			},
		}, nil
	}

	resp, err := svc.SalvarFichaComoTemplate(context.Background(), personalID, fichaID, SalvarFichaComoTemplateRequest{
		Nome: "  Full Body Modelo  ", Nivel: "AVANCADO", Objetivo: "forca",
	})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if fichaIDRecebido != fichaID || personalIDRecebido != personalID {
		t.Errorf("CriarFromFicha recebeu IDs errados: ficha=%v personal=%v", fichaIDRecebido, personalIDRecebido)
	}
	if nomeRecebido != "Full Body Modelo" {
		t.Errorf("nome deveria vir com trim, got %q", nomeRecebido)
	}
	if nivelRecebido != "AVANCADO" || objetivoRecebido != "forca" {
		t.Errorf("nivel/objetivo repassados incorretamente: %q/%q", nivelRecebido, objetivoRecebido)
	}
	if resp.ID != templateID.String() || resp.CriadoPor != string(domain.OrigemTemplatePersonal) {
		t.Errorf("resposta mapeada incorretamente: %+v", resp)
	}
	if len(resp.Itens) != 1 || resp.Itens[0].TreinoLetra != "A" {
		t.Errorf("itens da resposta mapeados incorretamente: %+v", resp.Itens)
	}
}
