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
