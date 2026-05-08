package application

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/amfit/api/internal/catalog/domain"
	"github.com/google/uuid"
)

// newServiceForTest devolve um CatalogService com mocks injetados, expostos
// para configuração caso a caso.
func newServiceForTest() (*CatalogService, *mockGrupoRepo, *mockExercicioRepo, *mockMidiaStorage) {
	grupos := &mockGrupoRepo{}
	exs := &mockExercicioRepo{}
	storage := &mockMidiaStorage{}
	svc := NewCatalogService(grupos, exs, storage)
	return svc, grupos, exs, storage
}

// fakeReader é um io.Reader trivial usado nos testes — não é consumido pelo
// mock de storage, apenas referenciado no struct MidiaUpload.
func fakeReader(content string) *bytes.Reader {
	return bytes.NewReader([]byte(content))
}

func TestListarExercicios_RetornaGlobaisEDoPersonal(t *testing.T) {
	svc, _, exs, _ := newServiceForTest()

	personalA := uuid.New()
	personalB := uuid.New()

	all := []*domain.ExercicioComGrupo{
		{Exercicio: domain.Exercicio{ID: uuid.New(), PersonalID: nil, Nome: "Supino", GrupoMuscularID: uuid.New(), Ativo: true}, GrupoMuscularNome: "Peitoral"},
		{Exercicio: domain.Exercicio{ID: uuid.New(), PersonalID: &personalA, Nome: "Crucifixo Custom", GrupoMuscularID: uuid.New(), Ativo: true}, GrupoMuscularNome: "Peitoral"},
		{Exercicio: domain.Exercicio{ID: uuid.New(), PersonalID: &personalB, Nome: "Privado B", GrupoMuscularID: uuid.New(), Ativo: true}, GrupoMuscularNome: "Peitoral"},
	}

	exs.listFn = func(ctx context.Context, p domain.ListExerciciosParams) ([]*domain.ExercicioComGrupo, error) {
		// Simula a query: globais (PersonalID nil) + os do PersonalID solicitado.
		out := make([]*domain.ExercicioComGrupo, 0)
		for _, e := range all {
			if e.PersonalID == nil || *e.PersonalID == p.PersonalID {
				out = append(out, e)
			}
		}
		return out, nil
	}

	resp, err := svc.ListarExercicios(context.Background(), domain.ListExerciciosParams{PersonalID: personalA})
	if err != nil {
		t.Fatalf("ListarExercicios: %v", err)
	}
	if len(resp.Data) != 2 {
		t.Fatalf("esperado 2 exercícios (1 global + 1 do personalA), got %d", len(resp.Data))
	}

	var sawGlobal, sawCustom bool
	for _, e := range resp.Data {
		switch e.Nome {
		case "Supino":
			if !e.IsGlobal {
				t.Errorf("Supino deveria ser global")
			}
			sawGlobal = true
		case "Crucifixo Custom":
			if e.IsGlobal {
				t.Errorf("Crucifixo Custom não deveria ser global")
			}
			sawCustom = true
		case "Privado B":
			t.Errorf("Privado B vazou para listagem do personalA")
		}
	}
	if !sawGlobal || !sawCustom {
		t.Fatal("esperava ver 1 global + 1 custom, falhou")
	}
}

func TestListarExercicios_FiltroGrupoMuscularPropagado(t *testing.T) {
	svc, _, exs, _ := newServiceForTest()

	wanted := uuid.New()
	exs.listFn = func(ctx context.Context, p domain.ListExerciciosParams) ([]*domain.ExercicioComGrupo, error) {
		if p.GrupoMuscularID == nil || *p.GrupoMuscularID != wanted {
			t.Errorf("filtro grupo_muscular_id não propagou: got %v want %v", p.GrupoMuscularID, wanted)
		}
		return nil, nil
	}

	_, err := svc.ListarExercicios(context.Background(), domain.ListExerciciosParams{
		PersonalID:      uuid.New(),
		GrupoMuscularID: &wanted,
	})
	if err != nil {
		t.Fatalf("ListarExercicios: %v", err)
	}
}

func TestListarExercicios_FiltroBuscaPropagado(t *testing.T) {
	svc, _, exs, _ := newServiceForTest()

	exs.listFn = func(ctx context.Context, p domain.ListExerciciosParams) ([]*domain.ExercicioComGrupo, error) {
		if p.Busca != "supino" {
			t.Errorf("busca não propagou: got %q want %q", p.Busca, "supino")
		}
		return nil, nil
	}

	_, err := svc.ListarExercicios(context.Background(), domain.ListExerciciosParams{
		PersonalID: uuid.New(),
		Busca:      "supino",
	})
	if err != nil {
		t.Fatalf("ListarExercicios: %v", err)
	}
}

func TestCriarExercicio_ComMidiaValida_FazUploadEPersiste(t *testing.T) {
	svc, _, exs, storage := newServiceForTest()

	personalID := uuid.New()
	grupoID := uuid.New()

	uploadCalled := false
	storage.uploadFn = func(ctx context.Context, exID uuid.UUID, m *MidiaUpload) (string, error) {
		uploadCalled = true
		if m.ContentType != "video/mp4" {
			t.Errorf("content-type esperado video/mp4, got %s", m.ContentType)
		}
		return "https://example.test/exercicios/" + exID.String() + ".mp4", nil
	}

	var savedExID uuid.UUID
	exs.createFn = func(ctx context.Context, e *domain.Exercicio) error {
		if e.PersonalID == nil || *e.PersonalID != personalID {
			t.Errorf("personal_id incorreto no exercício: %v", e.PersonalID)
		}
		if e.TipoMidia != string(domain.TipoMidiaVideo) {
			t.Errorf("tipo_midia esperado VIDEO, got %s", e.TipoMidia)
		}
		if e.MidiaURL == "" {
			t.Error("midia_url vazio após upload")
		}
		savedExID = e.ID
		return nil
	}
	exs.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.ExercicioComGrupo, error) {
		if id != savedExID {
			t.Errorf("FindByID id %v != saved %v", id, savedExID)
		}
		return &domain.ExercicioComGrupo{
			Exercicio: domain.Exercicio{
				ID: id, PersonalID: &personalID, Nome: "Supino", GrupoMuscularID: grupoID,
				MidiaURL: "https://example.test/exercicios/x.mp4", TipoMidia: string(domain.TipoMidiaVideo), Ativo: true,
			},
			GrupoMuscularNome: "Peitoral",
		}, nil
	}

	resp, err := svc.CriarExercicio(
		context.Background(),
		personalID,
		CriarExercicioInput{
			Nome:            "Supino Reto",
			Descricao:       "movimento composto para peitoral",
			GrupoMuscularID: grupoID.String(),
		},
		&MidiaUpload{
			Filename:    "supino.mp4",
			ContentType: "video/mp4",
			Size:        2 * 1024 * 1024,
			Reader:      fakeReader("fake-mp4"),
		},
	)
	if err != nil {
		t.Fatalf("CriarExercicio: %v", err)
	}
	if !uploadCalled {
		t.Fatal("UploadMidia não foi invocado")
	}
	if resp.TipoMidia != "VIDEO" {
		t.Errorf("response.tipo_midia esperado VIDEO, got %s", resp.TipoMidia)
	}
	if resp.IsGlobal {
		t.Error("exercício custom não deveria ser global")
	}
}

func TestCriarExercicio_TipoMimeInvalido_RetornaErrTipoMidiaInvalido(t *testing.T) {
	svc, _, _, _ := newServiceForTest()

	_, err := svc.CriarExercicio(
		context.Background(),
		uuid.New(),
		CriarExercicioInput{
			Nome:            "Inválido",
			GrupoMuscularID: uuid.New().String(),
		},
		&MidiaUpload{
			Filename:    "doc.pdf",
			ContentType: "application/pdf",
			Size:        1024,
			Reader:      fakeReader("fake-pdf"),
		},
	)
	if !errors.Is(err, domain.ErrTipoMidiaInvalido) {
		t.Fatalf("expected ErrTipoMidiaInvalido, got %v", err)
	}
}

func TestCriarExercicio_TamanhoExcedido_RetornaErr(t *testing.T) {
	svc, _, _, _ := newServiceForTest()

	_, err := svc.CriarExercicio(
		context.Background(),
		uuid.New(),
		CriarExercicioInput{
			Nome:            "Grande",
			GrupoMuscularID: uuid.New().String(),
		},
		&MidiaUpload{
			Filename:    "big.mp4",
			ContentType: "video/mp4",
			Size:        50 * 1024 * 1024,
			Reader:      fakeReader("fake-big"),
		},
	)
	if !errors.Is(err, domain.ErrMidiaTamanhoExcedido) {
		t.Fatalf("expected ErrMidiaTamanhoExcedido, got %v", err)
	}
}

func TestCriarExercicio_SemMidia_PersisteSemURL(t *testing.T) {
	svc, _, exs, storage := newServiceForTest()

	personalID := uuid.New()
	grupoID := uuid.New()

	storage.uploadFn = func(ctx context.Context, exID uuid.UUID, m *MidiaUpload) (string, error) {
		t.Fatal("UploadMidia não deveria ser chamado quando midia=nil")
		return "", nil
	}

	exs.createFn = func(ctx context.Context, e *domain.Exercicio) error {
		if e.MidiaURL != "" {
			t.Errorf("midia_url deveria ser vazio, got %q", e.MidiaURL)
		}
		if e.TipoMidia != "" {
			t.Errorf("tipo_midia deveria ser vazio, got %q", e.TipoMidia)
		}
		return nil
	}
	exs.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.ExercicioComGrupo, error) {
		return &domain.ExercicioComGrupo{
			Exercicio: domain.Exercicio{
				ID: id, PersonalID: &personalID, Nome: "Sem mídia", GrupoMuscularID: grupoID, Ativo: true,
			},
			GrupoMuscularNome: "Peitoral",
		}, nil
	}

	resp, err := svc.CriarExercicio(
		context.Background(),
		personalID,
		CriarExercicioInput{
			Nome:            "Sem mídia",
			GrupoMuscularID: grupoID.String(),
		},
		nil,
	)
	if err != nil {
		t.Fatalf("CriarExercicio: %v", err)
	}
	if resp.MidiaURL != "" || resp.TipoMidia != "" {
		t.Errorf("resposta deveria ter midia/tipo vazios, got url=%q tipo=%q", resp.MidiaURL, resp.TipoMidia)
	}
}

func TestAtualizarExercicio_Global_RetornaForbidden(t *testing.T) {
	svc, _, exs, _ := newServiceForTest()

	exID := uuid.New()
	personalID := uuid.New()

	exs.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.ExercicioComGrupo, error) {
		return &domain.ExercicioComGrupo{
			Exercicio: domain.Exercicio{
				ID: exID, PersonalID: nil, Nome: "Global", GrupoMuscularID: uuid.New(), Ativo: true,
			},
			GrupoMuscularNome: "Peitoral",
		}, nil
	}

	novo := "Novo Nome"
	_, err := svc.AtualizarExercicio(context.Background(), exID, personalID, AtualizarExercicioInput{
		Nome: &novo,
	})
	if !errors.Is(err, domain.ErrExercicioForbidden) {
		t.Fatalf("expected ErrExercicioForbidden, got %v", err)
	}
}

func TestAtualizarExercicio_DeOutroPersonal_RetornaForbidden(t *testing.T) {
	svc, _, exs, _ := newServiceForTest()

	exID := uuid.New()
	dono := uuid.New()
	intruso := uuid.New()

	exs.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.ExercicioComGrupo, error) {
		return &domain.ExercicioComGrupo{
			Exercicio: domain.Exercicio{
				ID: exID, PersonalID: &dono, Nome: "Custom", GrupoMuscularID: uuid.New(), Ativo: true,
			},
			GrupoMuscularNome: "Peitoral",
		}, nil
	}

	novo := "Renomeado"
	_, err := svc.AtualizarExercicio(context.Background(), exID, intruso, AtualizarExercicioInput{
		Nome: &novo,
	})
	if !errors.Is(err, domain.ErrExercicioForbidden) {
		t.Fatalf("expected ErrExercicioForbidden, got %v", err)
	}
}

func TestAtualizarExercicio_Sucesso_AplicaCampos(t *testing.T) {
	svc, _, exs, _ := newServiceForTest()

	exID := uuid.New()
	personalID := uuid.New()
	grupoOrig := uuid.New()
	novoGrupo := uuid.New()

	exs.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.ExercicioComGrupo, error) {
		return &domain.ExercicioComGrupo{
			Exercicio: domain.Exercicio{
				ID: exID, PersonalID: &personalID, Nome: "Antigo",
				Descricao: "desc antiga", GrupoMuscularID: grupoOrig, Ativo: true,
			},
			GrupoMuscularNome: "Peitoral",
		}, nil
	}

	updated := false
	exs.updateFn = func(ctx context.Context, e *domain.Exercicio) error {
		updated = true
		if e.Nome != "Novo nome" {
			t.Errorf("nome esperado %q, got %q", "Novo nome", e.Nome)
		}
		if e.GrupoMuscularID != novoGrupo {
			t.Errorf("grupo_muscular_id esperado %v, got %v", novoGrupo, e.GrupoMuscularID)
		}
		return nil
	}

	novoNome := "Novo nome"
	novoGrupoStr := novoGrupo.String()
	_, err := svc.AtualizarExercicio(context.Background(), exID, personalID, AtualizarExercicioInput{
		Nome:            &novoNome,
		GrupoMuscularID: &novoGrupoStr,
	})
	if err != nil {
		t.Fatalf("AtualizarExercicio: %v", err)
	}
	if !updated {
		t.Fatal("Update não foi chamado")
	}
}

func TestDesativarExercicio_DeOutroPersonal_RetornaForbidden(t *testing.T) {
	svc, _, exs, _ := newServiceForTest()

	exID := uuid.New()
	dono := uuid.New()
	intruso := uuid.New()

	exs.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.ExercicioComGrupo, error) {
		return &domain.ExercicioComGrupo{
			Exercicio: domain.Exercicio{
				ID: exID, PersonalID: &dono, Nome: "Custom", GrupoMuscularID: uuid.New(), Ativo: true,
			},
			GrupoMuscularNome: "Peitoral",
		}, nil
	}

	err := svc.DesativarExercicio(context.Background(), exID, intruso)
	if !errors.Is(err, domain.ErrExercicioForbidden) {
		t.Fatalf("expected ErrExercicioForbidden, got %v", err)
	}
}

func TestListarGruposMusculares_OrdenaConformeRepo(t *testing.T) {
	svc, grupos, _, _ := newServiceForTest()

	grupos.listAllFn = func(ctx context.Context) ([]*domain.GrupoMuscular, error) {
		return []*domain.GrupoMuscular{
			{ID: uuid.New(), Nome: "Costas"},
			{ID: uuid.New(), Nome: "Peitoral"},
		}, nil
	}

	resp, err := svc.ListarGruposMusculares(context.Background())
	if err != nil {
		t.Fatalf("ListarGruposMusculares: %v", err)
	}
	if len(resp.Data) != 2 {
		t.Fatalf("esperado 2, got %d", len(resp.Data))
	}
	got := strings.Join([]string{resp.Data[0].Nome, resp.Data[1].Nome}, ",")
	if got != "Costas,Peitoral" {
		t.Errorf("ordem esperada Costas,Peitoral, got %s", got)
	}
}
