//go:build integration

package infrastructure_test

import (
	"errors"
	"testing"

	"github.com/amfit/api/internal/catalog/domain"
	"github.com/amfit/api/internal/catalog/infrastructure"
	"github.com/amfit/api/internal/testsupport/pgtest"
	"github.com/google/uuid"
)

type env struct {
	*pgtest.Seed
	repos *infrastructure.PostgresRepositories
}

func novoEnv(t *testing.T) *env {
	t.Helper()
	pool := pgtest.NewDB(t)
	return &env{Seed: pgtest.NewSeed(t, pool), repos: infrastructure.NewPostgresRepositories(pool)}
}

// doisGrupos devolve dois grupos musculares da seed, na ordem alfabetica.
func (e *env) doisGrupos() (domain.GrupoMuscular, domain.GrupoMuscular) {
	e.T.Helper()
	grupos, err := e.repos.GruposMusculares.ListAll(e.Ctx)
	if err != nil || len(grupos) < 2 {
		e.T.Fatalf("a seed deveria ter ao menos 2 grupos: %d err=%v", len(grupos), err)
	}
	return *grupos[0], *grupos[1]
}

func (e *env) novoExercicio(personal *uuid.UUID, nome string, grupo uuid.UUID) *domain.Exercicio {
	ex := &domain.Exercicio{ID: uuid.New(), PersonalID: personal, Nome: nome, GrupoMuscularID: grupo, Ativo: true}
	if err := e.repos.Exercicios.Create(e.Ctx, ex); err != nil {
		e.T.Fatalf("criar exercicio %q: %v", nome, err)
	}
	return ex
}

func nomes(xs []*domain.ExercicioComGrupo) []string {
	out := make([]string, len(xs))
	for i, x := range xs {
		out[i] = x.Nome
	}
	return out
}

func contem(xs []*domain.ExercicioComGrupo, id uuid.UUID) bool {
	for _, x := range xs {
		if x.ID == id {
			return true
		}
	}
	return false
}

// ── GrupoMuscular ──────────────────────────────────────────────────────────

func TestGrupoMuscular_ListAllEFindByID(t *testing.T) {
	e := novoEnv(t)

	grupos, err := e.repos.GruposMusculares.ListAll(e.Ctx)
	if err != nil || len(grupos) == 0 {
		t.Fatalf("a seed das migrations deveria trazer grupos: %d err=%v", len(grupos), err)
	}
	for i := 1; i < len(grupos); i++ {
		if grupos[i-1].Nome > grupos[i].Nome {
			t.Errorf("ListAll deveria ordenar por nome: %q antes de %q", grupos[i-1].Nome, grupos[i].Nome)
		}
	}

	got, err := e.repos.GruposMusculares.FindByID(e.Ctx, grupos[0].ID)
	if err != nil || got.Nome != grupos[0].Nome {
		t.Errorf("FindByID: %+v err=%v", got, err)
	}
	if _, err := e.repos.GruposMusculares.FindByID(e.Ctx, uuid.New()); !errors.Is(err, domain.ErrGrupoMuscularNotFound) {
		t.Errorf("inexistente: got %v", err)
	}
}

// ── Exercicio ──────────────────────────────────────────────────────────────

func TestExercicio_CreateEFindByID(t *testing.T) {
	e := novoEnv(t)
	p := e.Personal()
	g, _ := e.doisGrupos()

	comMidia := &domain.Exercicio{
		ID: uuid.New(), PersonalID: &p, Nome: "Remada", Descricao: "pegada neutra", GrupoMuscularID: g.ID,
		MidiaURL: "https://cdn/remada.mp4", TipoMidia: "VIDEO", Ativo: true,
	}
	if err := e.repos.Exercicios.Create(e.Ctx, comMidia); err != nil {
		t.Fatal(err)
	}
	if comMidia.CriadoEm.IsZero() {
		t.Error("Create deveria preencher criado_em")
	}

	got, err := e.repos.Exercicios.FindByID(e.Ctx, comMidia.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Nome != "Remada" || got.Descricao != "pegada neutra" || got.MidiaURL != "https://cdn/remada.mp4" ||
		got.TipoMidia != "VIDEO" || got.GrupoMuscularNome != g.Nome || got.IsGlobal() || *got.PersonalID != p {
		t.Errorf("exercicio inesperado: %+v", got)
	}

	global := e.novoExercicio(nil, "Global sem midia", g.ID)
	got, _ = e.repos.Exercicios.FindByID(e.Ctx, global.ID)
	if !got.IsGlobal() || got.MidiaURL != "" || got.TipoMidia != "" || got.Descricao != "" {
		t.Errorf("opcionais ausentes deveriam voltar vazios: %+v", got)
	}

	if _, err := e.repos.Exercicios.FindByID(e.Ctx, uuid.New()); !errors.Is(err, domain.ErrExercicioNotFound) {
		t.Errorf("inexistente: %v", err)
	}
}

func TestExercicio_Create_Restricoes(t *testing.T) {
	e := novoEnv(t)
	g, _ := e.doisGrupos()

	tipoInvalido := &domain.Exercicio{ID: uuid.New(), Nome: "x", GrupoMuscularID: g.ID, MidiaURL: "u", TipoMidia: "AUDIO", Ativo: true}
	if err := e.repos.Exercicios.Create(e.Ctx, tipoInvalido); err == nil {
		t.Error("tipo_midia fora do enum deveria falhar")
	}
	semGrupo := &domain.Exercicio{ID: uuid.New(), Nome: "x", GrupoMuscularID: uuid.New(), Ativo: true}
	if err := e.repos.Exercicios.Create(e.Ctx, semGrupo); err == nil {
		t.Error("grupo muscular inexistente deveria violar a FK")
	}
	semDono := &domain.Exercicio{ID: uuid.New(), PersonalID: ptrU(uuid.New()), Nome: "x", GrupoMuscularID: g.ID, Ativo: true}
	if err := e.repos.Exercicios.Create(e.Ctx, semDono); err == nil {
		t.Error("personal inexistente deveria violar a FK")
	}
}

func ptrU(u uuid.UUID) *uuid.UUID { return &u }

func TestExercicio_List(t *testing.T) {
	e := novoEnv(t)
	p, outro := e.Personal(), e.Personal()
	g1, g2 := e.doisGrupos()

	// Prefixo unico: a seed das migrations tambem traz exercicios globais.
	global1 := e.novoExercicio(nil, "zzt Agachamento", g1.ID)
	meuG2 := e.novoExercicio(&p, "zzt Barra fixa", g2.ID)
	meuG1 := e.novoExercicio(&p, "zzt Afundo", g1.ID)
	alheio := e.novoExercicio(&outro, "zzt Alheio", g1.ID)
	inativo := e.novoExercicio(&p, "zzt Inativo", g1.ID)
	e.Exec(`UPDATE exercicio SET ativo = FALSE WHERE id = $1`, inativo.ID)

	t.Run("globais + proprios; sem alheios nem inativos", func(t *testing.T) {
		got, err := e.repos.Exercicios.List(e.Ctx, domain.ListExerciciosParams{PersonalID: p, Busca: "zzt"})
		if err != nil {
			t.Fatal(err)
		}
		if !contem(got, global1.ID) || !contem(got, meuG1.ID) || !contem(got, meuG2.ID) {
			t.Errorf("faltou global/proprio: %v", nomes(got))
		}
		if contem(got, alheio.ID) || contem(got, inativo.ID) {
			t.Errorf("vazou exercicio de outro personal ou inativo: %v", nomes(got))
		}
	})

	t.Run("ordena por grupo muscular e depois por nome", func(t *testing.T) {
		got, _ := e.repos.Exercicios.List(e.Ctx, domain.ListExerciciosParams{PersonalID: p, Busca: "zzt"})
		for i := 1; i < len(got); i++ {
			a, b := got[i-1], got[i]
			if a.GrupoMuscularNome > b.GrupoMuscularNome ||
				(a.GrupoMuscularNome == b.GrupoMuscularNome && a.Nome > b.Nome) {
				t.Errorf("ordem invalida: %q(%s) antes de %q(%s)", a.Nome, a.GrupoMuscularNome, b.Nome, b.GrupoMuscularNome)
			}
		}
	})

	t.Run("filtra por grupo muscular", func(t *testing.T) {
		got, _ := e.repos.Exercicios.List(e.Ctx, domain.ListExerciciosParams{PersonalID: p, GrupoMuscularID: &g2.ID, Busca: "zzt"})
		if len(got) != 1 || got[0].ID != meuG2.ID {
			t.Errorf("grupo 2: %v", nomes(got))
		}
	})

	t.Run("busca por nome ignora maiusculas", func(t *testing.T) {
		got, _ := e.repos.Exercicios.List(e.Ctx, domain.ListExerciciosParams{PersonalID: p, Busca: "ZZT BARRA"})
		if len(got) != 1 || got[0].ID != meuG2.ID {
			t.Errorf("busca: %v", nomes(got))
		}
	})

	t.Run("sem resultados devolve slice vazio", func(t *testing.T) {
		got, err := e.repos.Exercicios.List(e.Ctx, domain.ListExerciciosParams{PersonalID: p, Busca: "nada-assim-existe-xyz"})
		if err != nil || got == nil || len(got) != 0 {
			t.Errorf("got %#v err=%v", got, err)
		}
	})
}

func TestExercicio_Update(t *testing.T) {
	e := novoEnv(t)
	p := e.Personal()
	g1, g2 := e.doisGrupos()
	ex := e.novoExercicio(&p, "Original", g1.ID)
	e.Exec(`UPDATE exercicio SET descricao = 'antiga', midia_url = 'https://m', tipo_midia = 'GIF' WHERE id = $1`, ex.ID)

	ex.Nome, ex.Descricao, ex.GrupoMuscularID = "Renomeado", "", g2.ID
	if err := e.repos.Exercicios.Update(e.Ctx, ex); err != nil {
		t.Fatal(err)
	}
	got, _ := e.repos.Exercicios.FindByID(e.Ctx, ex.ID)
	if got.Nome != "Renomeado" || got.Descricao != "" || got.GrupoMuscularID != g2.ID || got.GrupoMuscularNome != g2.Nome {
		t.Errorf("update nao persistiu: %+v", got)
	}
	if got.MidiaURL != "https://m" || got.TipoMidia != "GIF" {
		t.Errorf("Update nao deve tocar na midia: %+v", got)
	}

	if err := e.repos.Exercicios.Update(e.Ctx, &domain.Exercicio{ID: uuid.New(), Nome: "x", GrupoMuscularID: g1.ID}); !errors.Is(err, domain.ErrExercicioNotFound) {
		t.Errorf("inexistente: %v", err)
	}

	e.Exec(`UPDATE exercicio SET ativo = FALSE WHERE id = $1`, ex.ID)
	if err := e.repos.Exercicios.Update(e.Ctx, ex); !errors.Is(err, domain.ErrExercicioNotFound) {
		t.Errorf("exercicio desativado nao pode ser editado, got %v", err)
	}
}

func TestExercicio_Deactivate(t *testing.T) {
	e := novoEnv(t)
	p, outro := e.Personal(), e.Personal()
	g, _ := e.doisGrupos()
	meu := e.novoExercicio(&p, "Meu", g.ID)
	global := e.novoExercicio(nil, "Global", g.ID)
	alheio := e.novoExercicio(&outro, "Alheio", g.ID)

	for nome, c := range map[string]struct{ id, dono uuid.UUID }{
		"global":               {global.ID, p},
		"de outro personal":    {alheio.ID, p},
		"inexistente":          {uuid.New(), p},
		"proprio, dono errado": {meu.ID, outro},
	} {
		if err := e.repos.Exercicios.Deactivate(e.Ctx, c.id, c.dono); !errors.Is(err, domain.ErrExercicioForbidden) {
			t.Errorf("%s: got %v, want ErrExercicioForbidden", nome, err)
		}
	}
	// Nenhuma das tentativas negadas pode ter desativado nada.
	for _, id := range []uuid.UUID{meu.ID, global.ID, alheio.ID} {
		if _, err := e.repos.Exercicios.FindByID(e.Ctx, id); err != nil {
			t.Errorf("exercicio %s foi desativado indevidamente: %v", id, err)
		}
	}

	if err := e.repos.Exercicios.Deactivate(e.Ctx, meu.ID, p); err != nil {
		t.Fatal(err)
	}
	if _, err := e.repos.Exercicios.FindByID(e.Ctx, meu.ID); !errors.Is(err, domain.ErrExercicioNotFound) {
		t.Errorf("desativado nao deveria ser encontrado: %v", err)
	}
	if err := e.repos.Exercicios.Deactivate(e.Ctx, meu.ID, p); !errors.Is(err, domain.ErrExercicioForbidden) {
		t.Errorf("desativar de novo: got %v", err)
	}
}
