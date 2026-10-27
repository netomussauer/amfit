//go:build integration

package infrastructure_test

import (
	"errors"
	"testing"
	"time"

	"github.com/amfit/api/internal/coach/domain"
	"github.com/amfit/api/internal/coach/infrastructure"
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

type cenario struct {
	personal, aluno, item uuid.UUID
}

func (e *env) cenario() cenario {
	c := cenario{personal: e.Personal()}
	c.aluno = e.Aluno(c.personal)
	treino := e.Treino(e.FichaVigente(c.personal, c.aluno), "A", 0)
	c.item = e.Item(treino, e.Exercicio("Agachamento", nil), 0, 3)
	return c
}

func (e *env) video(c cenario, item *uuid.UUID, descricao string) *domain.CoachVideo {
	v := &domain.CoachVideo{
		ID: uuid.New(), AlunoID: c.aluno, PersonalID: c.personal, ItemTreinoID: item,
		VideoObjectKey: "videos/" + uuid.NewString() + ".mp4", DuracaoSegundos: 30,
		Status: domain.StatusCoachVideoAguardandoFeedback, Descricao: descricao,
	}
	if err := e.repos.Videos.Create(e.Ctx, v); err != nil {
		e.T.Fatalf("criar video: %v", err)
	}
	return v
}

func ids(vs []*domain.CoachVideoComFeedback) []uuid.UUID {
	out := make([]uuid.UUID, len(vs))
	for i, v := range vs {
		out[i] = v.ID
	}
	return out
}

func igual(a, b []uuid.UUID) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestVideo_CreateEFindComFeedback(t *testing.T) {
	e := novoEnv(t)
	c := e.cenario()

	v := e.video(c, &c.item, "agachamento com dor")
	if v.CriadoEm.IsZero() || v.AtualizadoEm.IsZero() {
		t.Error("Create deveria preencher criado_em/atualizado_em")
	}

	got, err := e.repos.Videos.FindComFeedback(e.Ctx, v.ID)
	if err != nil || got == nil {
		t.Fatalf("FindComFeedback: %v %v", got, err)
	}
	if got.AlunoNome != "Aluno" || got.ExercicioNome == nil || *got.ExercicioNome != "Agachamento" ||
		got.Descricao != "agachamento com dor" || got.DuracaoSegundos != 30 ||
		got.Status != domain.StatusCoachVideoAguardandoFeedback || got.Feedback != nil {
		t.Errorf("video inesperado: %+v", got)
	}

	semItem := e.video(c, nil, "")
	got, _ = e.repos.Videos.FindComFeedback(e.Ctx, semItem.ID)
	if got.ExercicioNome != nil || got.ItemTreinoID != nil || got.Descricao != "" {
		t.Errorf("video sem exercicio/descricao: %+v", got)
	}

	if g, err := e.repos.Videos.FindComFeedback(e.Ctx, uuid.New()); g != nil || err != nil {
		t.Errorf("inexistente deve ser (nil, nil), got %v %v", g, err)
	}
}

func TestVideo_Create_Restricoes(t *testing.T) {
	e := novoEnv(t)
	c := e.cenario()
	base := func() *domain.CoachVideo {
		return &domain.CoachVideo{ID: uuid.New(), AlunoID: c.aluno, PersonalID: c.personal, VideoObjectKey: "k",
			DuracaoSegundos: 10, Status: domain.StatusCoachVideoAguardandoFeedback}
	}

	itemFantasma := base()
	itemFantasma.ItemTreinoID = ptrU(uuid.New())
	if err := e.repos.Videos.Create(e.Ctx, itemFantasma); !errors.Is(err, domain.ErrItemTreinoInvalido) {
		t.Errorf("item_treino inexistente: got %v, want ErrItemTreinoInvalido", err)
	}

	for _, dur := range []int{0, -5, 61} {
		v := base()
		v.DuracaoSegundos = dur
		err := e.repos.Videos.Create(e.Ctx, v)
		if err == nil || errors.Is(err, domain.ErrItemTreinoInvalido) {
			t.Errorf("duracao %d deveria violar o CHECK (1..60) com erro generico, got %v", dur, err)
		}
	}
	for _, dur := range []int{1, 60} {
		v := base()
		v.DuracaoSegundos = dur
		if err := e.repos.Videos.Create(e.Ctx, v); err != nil {
			t.Errorf("duracao %d (limite valido): %v", dur, err)
		}
	}
}

func ptrU(u uuid.UUID) *uuid.UUID { return &u }

func TestFeedback_UnicoPorVideoEMarcarEnviado(t *testing.T) {
	e := novoEnv(t)
	c := e.cenario()
	v := e.video(c, nil, "")

	f := &domain.CoachVideoFeedback{ID: uuid.New(), VideoID: v.ID, PersonalID: c.personal, Texto: "Joelho para fora"}
	if err := e.repos.Feedbacks.Create(e.Ctx, f); err != nil {
		t.Fatal(err)
	}
	if f.EnviadoEm.IsZero() {
		t.Error("Create deveria preencher enviado_em")
	}

	segundo := &domain.CoachVideoFeedback{ID: uuid.New(), VideoID: v.ID, PersonalID: c.personal, Texto: "Outro"}
	if err := e.repos.Feedbacks.Create(e.Ctx, segundo); !errors.Is(err, domain.ErrCoachVideoJaTemFeedback) {
		t.Errorf("segundo feedback: got %v, want ErrCoachVideoJaTemFeedback", err)
	}

	orfao := &domain.CoachVideoFeedback{ID: uuid.New(), VideoID: uuid.New(), PersonalID: c.personal, Texto: "x"}
	if err := e.repos.Feedbacks.Create(e.Ctx, orfao); err == nil || errors.Is(err, domain.ErrCoachVideoJaTemFeedback) {
		t.Errorf("video inexistente deveria violar a FK, got %v", err)
	}

	antes, _ := e.repos.Videos.FindComFeedback(e.Ctx, v.ID)
	if antes.Feedback == nil || antes.Feedback.Texto != "Joelho para fora" || antes.Feedback.PersonalID == uuid.Nil && false {
		t.Fatalf("feedback deveria vir junto do video: %+v", antes.Feedback)
	}
	if antes.Status != domain.StatusCoachVideoAguardandoFeedback {
		t.Errorf("criar o feedback nao muda o status sozinho: %s", antes.Status)
	}

	time.Sleep(5 * time.Millisecond)
	if err := e.repos.Videos.MarcarFeedbackEnviado(e.Ctx, v.ID); err != nil {
		t.Fatal(err)
	}
	depois, _ := e.repos.Videos.FindComFeedback(e.Ctx, v.ID)
	if depois.Status != domain.StatusCoachVideoFeedbackEnviado || !depois.AtualizadoEm.After(antes.AtualizadoEm) {
		t.Errorf("status/atualizado_em: %s %v -> %v", depois.Status, antes.AtualizadoEm, depois.AtualizadoEm)
	}
	if err := e.repos.Videos.MarcarFeedbackEnviado(e.Ctx, uuid.New()); err != nil {
		t.Errorf("id inexistente nao deve falhar (UPDATE sem linhas): %v", err)
	}
}

func TestVideo_Listagens(t *testing.T) {
	e := novoEnv(t)
	c := e.cenario()
	outroAluno := e.Aluno(c.personal)
	outroPersonal := e.Personal()
	alheioAluno := e.Aluno(outroPersonal)

	v1 := e.video(c, nil, "um")
	v2 := e.video(c, nil, "dois")
	v3 := e.video(c, nil, "tres")
	// criado_em explicito: now() e identico dentro de uma mesma transacao rapida e a ordem ficaria ambigua.
	for i, id := range []uuid.UUID{v1.ID, v2.ID, v3.ID} {
		e.Exec(`UPDATE coach_video SET criado_em = NOW() - make_interval(mins => $2) WHERE id = $1`, id, 30-10*i)
	}
	if err := e.repos.Feedbacks.Create(e.Ctx, &domain.CoachVideoFeedback{ID: uuid.New(), VideoID: v2.ID, PersonalID: c.personal, Texto: "ok"}); err != nil {
		t.Fatal(err)
	}
	if err := e.repos.Videos.MarcarFeedbackEnviado(e.Ctx, v2.ID); err != nil {
		t.Fatal(err)
	}
	doOutroAluno := &domain.CoachVideo{ID: uuid.New(), AlunoID: outroAluno, PersonalID: c.personal, VideoObjectKey: "k",
		DuracaoSegundos: 5, Status: domain.StatusCoachVideoAguardandoFeedback}
	if err := e.repos.Videos.Create(e.Ctx, doOutroAluno); err != nil {
		t.Fatal(err)
	}
	alheio := &domain.CoachVideo{ID: uuid.New(), AlunoID: alheioAluno, PersonalID: outroPersonal, VideoObjectKey: "k",
		DuracaoSegundos: 5, Status: domain.StatusCoachVideoAguardandoFeedback}
	if err := e.repos.Videos.Create(e.Ctx, alheio); err != nil {
		t.Fatal(err)
	}

	t.Run("personal: so os dele, mais recentes primeiro, feedback anexado", func(t *testing.T) {
		got, total, err := e.repos.Videos.ListByPersonal(e.Ctx, c.personal, nil, 1, 10)
		if err != nil || total != 4 || len(got) != 4 {
			t.Fatalf("total=%d len=%d err=%v", total, len(got), err)
		}
		for _, v := range got {
			if v.ID == alheio.ID {
				t.Error("vazou video de outro personal")
			}
			if v.ID == v2.ID && (v.Feedback == nil || v.Feedback.Texto != "ok") {
				t.Errorf("feedback de v2 deveria vir anexado: %+v", v.Feedback)
			}
			if v.ID == v1.ID && v.Feedback != nil {
				t.Error("v1 nao tem feedback")
			}
		}
		// v3 (mais recente, 10 min) antes de v2 (20) antes de v1 (30); o do outro aluno e o mais novo de todos.
		pos := map[uuid.UUID]int{}
		for i, v := range got {
			pos[v.ID] = i
		}
		if !(pos[doOutroAluno.ID] < pos[v3.ID] && pos[v3.ID] < pos[v2.ID] && pos[v2.ID] < pos[v1.ID]) {
			t.Errorf("ordem deveria ser criado_em DESC: %v", ids(got))
		}
	})

	t.Run("personal: filtra por status", func(t *testing.T) {
		st := domain.StatusCoachVideoFeedbackEnviado
		got, total, _ := e.repos.Videos.ListByPersonal(e.Ctx, c.personal, &st, 1, 10)
		if total != 1 || len(got) != 1 || got[0].ID != v2.ID {
			t.Errorf("FEEDBACK_ENVIADO: total=%d %v", total, ids(got))
		}
		pend := domain.StatusCoachVideoAguardandoFeedback
		_, total, _ = e.repos.Videos.ListByPersonal(e.Ctx, c.personal, &pend, 1, 10)
		if total != 3 {
			t.Errorf("AGUARDANDO_FEEDBACK total = %d, want 3", total)
		}
	})

	t.Run("paginacao informa o total geral", func(t *testing.T) {
		p2, total, _ := e.repos.Videos.ListByPersonal(e.Ctx, c.personal, nil, 2, 3)
		if total != 4 || len(p2) != 1 {
			t.Errorf("pagina 2 (3 por pagina): total=%d len=%d", total, len(p2))
		}
	})

	t.Run("aluno: so os proprios", func(t *testing.T) {
		got, total, err := e.repos.Videos.ListByAluno(e.Ctx, c.aluno, 1, 10)
		if err != nil || total != 3 || !igual(ids(got), []uuid.UUID{v3.ID, v2.ID, v1.ID}) {
			t.Errorf("total=%d ids=%v err=%v", total, ids(got), err)
		}
	})

	t.Run("sem videos: slice vazio", func(t *testing.T) {
		got, total, err := e.repos.Videos.ListByAluno(e.Ctx, e.Aluno(c.personal), 1, 10)
		if err != nil || total != 0 || got == nil || len(got) != 0 {
			t.Errorf("got %#v total=%d err=%v", got, total, err)
		}
	})
}

func TestVideo_CascatasDeRemocao(t *testing.T) {
	e := novoEnv(t)
	c := e.cenario()
	v := e.video(c, &c.item, "x")
	if err := e.repos.Feedbacks.Create(e.Ctx, &domain.CoachVideoFeedback{ID: uuid.New(), VideoID: v.ID, PersonalID: c.personal, Texto: "t"}); err != nil {
		t.Fatal(err)
	}

	// Remover o item de treino NAO apaga o video: item_treino_id vira NULL.
	e.Exec(`DELETE FROM item_treino WHERE id = $1`, c.item)
	got, _ := e.repos.Videos.FindComFeedback(e.Ctx, v.ID)
	if got == nil || got.ItemTreinoID != nil || got.ExercicioNome != nil || got.Feedback == nil {
		t.Errorf("video deveria sobreviver sem o item (e manter o feedback): %+v", got)
	}

	// Remover o aluno apaga videos e feedbacks em cascata.
	e.Exec(`DELETE FROM aluno WHERE id = $1`, c.aluno)
	if g, _ := e.repos.Videos.FindComFeedback(e.Ctx, v.ID); g != nil {
		t.Error("video deveria ter sido removido com o aluno")
	}
	var feedbacks int
	if err := e.Pool.QueryRow(e.Ctx, `SELECT COUNT(*) FROM coach_video_feedback`).Scan(&feedbacks); err != nil || feedbacks != 0 {
		t.Errorf("feedbacks restantes: %d (err=%v)", feedbacks, err)
	}
}

func TestAlunoLookup_Coach(t *testing.T) {
	e := novoEnv(t)
	p, outro := e.Personal(), e.Personal()
	a := e.Aluno(p)

	for _, c := range []struct {
		nome         string
		aluno, owner uuid.UUID
		want         bool
	}{
		{"do personal", a, p, true},
		{"de outro personal", a, outro, false},
		{"inexistente", uuid.New(), p, false},
	} {
		got, err := e.repos.AlunoLookup.BelongsToPersonal(e.Ctx, c.aluno, c.owner)
		if err != nil || got != c.want {
			t.Errorf("%s: got %v err=%v, want %v", c.nome, got, err, c.want)
		}
	}

	pid, nome, err := e.repos.AlunoLookup.PersonalIDENome(e.Ctx, a)
	if err != nil || pid != p || nome != "Aluno" {
		t.Errorf("PersonalIDENome: %v %q err=%v", pid, nome, err)
	}
	if _, _, err := e.repos.AlunoLookup.PersonalIDENome(e.Ctx, uuid.New()); err == nil {
		t.Error("aluno inexistente deveria retornar erro")
	}
}
