package application

import (
	"context"
	"errors"
	"testing"

	"github.com/amfit/api/internal/progress/domain"
	"github.com/google/uuid"
)

func validRespostas() domain.AnamneseRespostasInput {
	return domain.AnamneseRespostasInput{
		FrequenciaSemanal: "3_4_dias",
		ExperienciaMeses:  "6_meses_2_anos",
		Objetivo:          "hipertrofia",
		Restricoes:        "nao",
		Disponibilidade:   "3_dias",
	}
}

// ── RegistrarAnamnese ────────────────────────────────────────────────────

func TestRegistrarAnamnese_AlunoDeOutroPersonal_NaoSalvaNemBuscaTemplate(t *testing.T) {
	svc, access, anamnese, templateMatcher := newAnamneseServiceForTest()

	access.alunoExisteEPertenceAoPersonalFn = func(ctx context.Context, p, a uuid.UUID) error {
		return domain.ErrAlunoNotFound
	}
	chamouUpsert := false
	anamnese.upsertFn = func(ctx context.Context, a *domain.Anamnese) error {
		chamouUpsert = true
		return nil
	}
	chamouMatch := false
	templateMatcher.melhorMatchFn = func(ctx context.Context, p uuid.UUID, nivel, objetivo string) (*domain.TemplateMatch, error) {
		chamouMatch = true
		return nil, nil
	}

	_, err := svc.RegistrarAnamnese(context.Background(), uuid.New(), uuid.New(), RegistrarAnamneseParams{
		Objetivo: "Ganhar massa", Respostas: validRespostas(),
	})
	if !errors.Is(err, domain.ErrAlunoNotFound) {
		t.Fatalf("esperado ErrAlunoNotFound, got %v", err)
	}
	if chamouUpsert {
		t.Error("Upsert nao deveria ter sido chamado — access check falhou antes")
	}
	if chamouMatch {
		t.Error("MelhorMatch nao deveria ter sido chamado — access check falhou antes")
	}
}

func TestRegistrarAnamnese_OpcaoInvalida_NaoSalva(t *testing.T) {
	svc, _, anamnese, _ := newAnamneseServiceForTest()

	chamouUpsert := false
	anamnese.upsertFn = func(ctx context.Context, a *domain.Anamnese) error {
		chamouUpsert = true
		return nil
	}

	respostas := validRespostas()
	respostas.Objetivo = "chave-invalida"

	_, err := svc.RegistrarAnamnese(context.Background(), uuid.New(), uuid.New(), RegistrarAnamneseParams{
		Objetivo: "Ganhar massa", Respostas: respostas,
	})
	if !errors.Is(err, domain.ErrOpcaoAnamneseInvalida) {
		t.Fatalf("esperado ErrOpcaoAnamneseInvalida, got %v", err)
	}
	if chamouUpsert {
		t.Error("Upsert nao deveria ter sido chamado — score invalido")
	}
}

func TestRegistrarAnamnese_CaminhoFeliz_CalculaScoreESalva(t *testing.T) {
	svc, _, anamnese, templateMatcher := newAnamneseServiceForTest()

	alunoID := uuid.New()
	personalID := uuid.New()

	var salvo *domain.Anamnese
	anamnese.upsertFn = func(ctx context.Context, a *domain.Anamnese) error {
		salvo = a
		a.ID = uuid.New()
		return nil
	}

	templateID := uuid.New()
	var nivelRecebido, objetivoRecebido string
	templateMatcher.melhorMatchFn = func(ctx context.Context, p uuid.UUID, nivel, objetivo string) (*domain.TemplateMatch, error) {
		if p != personalID {
			t.Errorf("MelhorMatch recebeu personalID errado: %v", p)
		}
		nivelRecebido = nivel
		objetivoRecebido = objetivo
		return &domain.TemplateMatch{ID: templateID, Nome: "Hipertrofia AB"}, nil
	}

	resultado, err := svc.RegistrarAnamnese(context.Background(), personalID, alunoID, RegistrarAnamneseParams{
		Objetivo: "Ganhar massa", Respostas: validRespostas(),
	})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}

	if salvo == nil || salvo.AlunoID != alunoID {
		t.Fatal("anamnese nao foi persistida com o aluno_id correto")
	}
	if salvo.ScoreCalculado != 50 { // 20+15+10+0+5, mesmo exemplo do SDD
		t.Errorf("score_calculado = %d, esperado 50", salvo.ScoreCalculado)
	}
	if salvo.NivelSugerido != domain.NivelIntermediario {
		t.Errorf("nivel_sugerido = %s, esperado INTERMEDIARIO", salvo.NivelSugerido)
	}
	if nivelRecebido != "INTERMEDIARIO" || objetivoRecebido != "hipertrofia" {
		t.Errorf("MelhorMatch recebeu (%s, %s), esperado (INTERMEDIARIO, hipertrofia)", nivelRecebido, objetivoRecebido)
	}
	if resultado.Template == nil || resultado.Template.ID != templateID {
		t.Error("resultado deveria incluir o template retornado por MelhorMatch")
	}
}

func TestRegistrarAnamnese_SemTemplateMatcher_NaoQuebra(t *testing.T) {
	access := &mockAccessRepo{}
	anamneseRepo := &mockAnamneseRepo{}
	svc := NewProgressService(&mockHistoricoRepo{}, &mockDashboardRepo{}, access, anamneseRepo, nil)

	resultado, err := svc.RegistrarAnamnese(context.Background(), uuid.New(), uuid.New(), RegistrarAnamneseParams{
		Objetivo: "Ganhar massa", Respostas: validRespostas(),
	})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if resultado.Template != nil {
		t.Error("sem templateMatcher configurado, Template deveria ficar nil")
	}
}

// ── ObterAnamnese ────────────────────────────────────────────────────────

func TestObterAnamnese_AlunoSemAnamnese_RetornaNotFound(t *testing.T) {
	svc, _, anamnese, _ := newAnamneseServiceForTest()
	anamnese.findByAlunoIDFn = func(ctx context.Context, alunoID uuid.UUID) (*domain.Anamnese, error) {
		return nil, domain.ErrAnamneseNotFound
	}

	_, err := svc.ObterAnamnese(context.Background(), uuid.New(), uuid.New())
	if !errors.Is(err, domain.ErrAnamneseNotFound) {
		t.Fatalf("esperado ErrAnamneseNotFound, got %v", err)
	}
}

func TestObterAnamnese_AlunoDeOutroPersonal_NaoConsultaRepositorio(t *testing.T) {
	svc, access, anamnese, _ := newAnamneseServiceForTest()
	access.alunoExisteEPertenceAoPersonalFn = func(ctx context.Context, p, a uuid.UUID) error {
		return domain.ErrAlunoNotFound
	}
	chamou := false
	anamnese.findByAlunoIDFn = func(ctx context.Context, alunoID uuid.UUID) (*domain.Anamnese, error) {
		chamou = true
		return nil, domain.ErrAnamneseNotFound
	}

	_, err := svc.ObterAnamnese(context.Background(), uuid.New(), uuid.New())
	if !errors.Is(err, domain.ErrAlunoNotFound) {
		t.Fatalf("esperado ErrAlunoNotFound, got %v", err)
	}
	if chamou {
		t.Error("FindByAlunoID nao deveria ter sido chamado — access check falhou antes")
	}
}
