//go:build integration

package infrastructure_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/amfit/api/internal/testsupport/pgtest"
	"github.com/amfit/api/internal/training/domain"
	"github.com/amfit/api/internal/training/infrastructure"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ── Harness / fixtures ─────────────────────────────────────────────────────

type env struct {
	t     *testing.T
	pool  *pgxpool.Pool
	repos *infrastructure.PostgresRepositories
	ctx   context.Context
	grupo uuid.UUID // um grupo_muscular da seed
}

func novoEnv(t *testing.T) *env {
	t.Helper()
	pool := pgtest.NewDB(t)
	e := &env{t: t, pool: pool, repos: infrastructure.NewPostgresRepositories(pool), ctx: context.Background()}
	e.must(pool.QueryRow(e.ctx, `SELECT id FROM grupo_muscular ORDER BY nome LIMIT 1`).Scan(&e.grupo))
	return e
}

func (e *env) must(err error) {
	e.t.Helper()
	if err != nil {
		e.t.Fatal(err)
	}
}

func (e *env) exec(sql string, args ...any) {
	e.t.Helper()
	_, err := e.pool.Exec(e.ctx, sql, args...)
	e.must(err)
}

// hoje devolve CURRENT_DATE do proprio banco (evita divergencia de fuso entre
// o relogio do Go e o do container nas regras de vigencia).
func (e *env) hoje() time.Time {
	e.t.Helper()
	var d time.Time
	e.must(e.pool.QueryRow(e.ctx, `SELECT CURRENT_DATE`).Scan(&d))
	return d
}

func (e *env) dias(n int) time.Time { return e.hoje().AddDate(0, 0, n) }

func (e *env) personal() uuid.UUID {
	id := uuid.New()
	e.exec(`INSERT INTO personal_trainer (id, nome, email, codigo) VALUES ($1, 'P', $2, $3)`,
		id, id.String()+"@t.test", id.String()[:8])
	return id
}

func (e *env) aluno(personal uuid.UUID) uuid.UUID {
	id := uuid.New()
	e.exec(`INSERT INTO aluno (id, personal_id, nome, email) VALUES ($1, $2, 'A', $3)`,
		id, personal, id.String()+"@a.test")
	return id
}

// exercicio cria um exercicio; personal == nil => global.
func (e *env) exercicio(nome string, personal *uuid.UUID) uuid.UUID {
	id := uuid.New()
	e.exec(`INSERT INTO exercicio (id, personal_id, nome, grupo_muscular_id) VALUES ($1, $2, $3, $4)`,
		id, personal, nome, e.grupo)
	return id
}

func (e *env) ficha(personal, aluno uuid.UUID, nome string, inicio time.Time, fim *time.Time, ativa bool) *domain.FichaTreino {
	f := &domain.FichaTreino{
		ID: uuid.New(), AlunoID: aluno, PersonalID: personal, Nome: nome,
		VigenciaInicio: inicio, VigenciaFim: fim, Ativa: ativa,
	}
	e.must(e.repos.Fichas.Create(e.ctx, f))
	return f
}

func (e *env) treino(ficha uuid.UUID, letra string, ordem int) *domain.Treino {
	tr := &domain.Treino{ID: uuid.New(), FichaID: ficha, Letra: letra, Ordem: ordem}
	e.must(e.repos.Treinos.Create(e.ctx, tr))
	return tr
}

func (e *env) item(treino, exercicio uuid.UUID, ordem int) *domain.ItemTreino {
	it := &domain.ItemTreino{
		ID: uuid.New(), TreinoID: treino, ExercicioID: exercicio, Ordem: ordem,
		Series: 3, Repeticoes: "10",
	}
	e.must(e.repos.Itens.Create(e.ctx, it))
	return it
}

func (e *env) sessao(aluno, treino uuid.UUID, data time.Time, status string, concluidoEm *time.Time) uuid.UUID {
	id := uuid.New()
	e.exec(`INSERT INTO sessao_treino (id, aluno_id, treino_id, data_execucao, status, concluido_em)
	        VALUES ($1, $2, $3, $4, $5::status_sessao, $6)`, id, aluno, treino, data, status, concluidoEm)
	return id
}

func ids(fs []*domain.FichaTreino) []uuid.UUID {
	out := make([]uuid.UUID, len(fs))
	for i, f := range fs {
		out[i] = f.ID
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

// ── Ficha ──────────────────────────────────────────────────────────────────

func TestFicha_CreateEFindByID(t *testing.T) {
	e := novoEnv(t)
	p := e.personal()
	a := e.aluno(p)
	fim := e.dias(30)

	f := e.ficha(p, a, "Hipertrofia", e.dias(-1), &fim, true)
	if f.CriadoEm.IsZero() || f.AtualizadoEm.IsZero() {
		t.Error("Create deveria preencher criado_em/atualizado_em")
	}

	got, err := e.repos.Fichas.FindByID(e.ctx, f.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Nome != "Hipertrofia" || got.AlunoID != a || got.PersonalID != p || !got.Ativa ||
		got.VigenciaFim == nil || !got.VigenciaFim.Equal(fim) {
		t.Errorf("ficha inesperada: %+v", got)
	}

	semFim := e.ficha(p, a, "Sem fim", e.dias(0), nil, true)
	got, _ = e.repos.Fichas.FindByID(e.ctx, semFim.ID)
	if got.VigenciaFim != nil {
		t.Errorf("vigencia_fim deveria ser nula, got %v", got.VigenciaFim)
	}

	if _, err := e.repos.Fichas.FindByID(e.ctx, uuid.New()); !errors.Is(err, domain.ErrFichaNotFound) {
		t.Errorf("inexistente: got %v", err)
	}
}

func TestFicha_List_FiltrosOrdemEContagemDeTreinos(t *testing.T) {
	e := novoEnv(t)
	p, outroP := e.personal(), e.personal()
	a1, a2 := e.aluno(p), e.aluno(p)
	aAlheio := e.aluno(outroP)

	f1 := e.ficha(p, a1, "f1", e.dias(-10), nil, true)
	f2 := e.ficha(p, a1, "f2", e.dias(-5), nil, false)
	f3 := e.ficha(p, a2, "f3", e.dias(-1), nil, true)
	e.ficha(outroP, aAlheio, "alheia", e.dias(-1), nil, true)
	e.treino(f1.ID, "A", 0)
	e.treino(f1.ID, "B", 1)

	boolp := func(b bool) *bool { return &b }

	todas, err := e.repos.Fichas.List(e.ctx, domain.ListFichasFilter{PersonalID: p})
	if err != nil {
		t.Fatal(err)
	}
	if !igual(ids(todas), []uuid.UUID{f3.ID, f2.ID, f1.ID}) {
		t.Errorf("ordem esperada criado_em DESC e sem fichas alheias, got %v", ids(todas))
	}
	for _, f := range todas {
		if f.ID == f1.ID && f.TotalTreinos != 2 {
			t.Errorf("TotalTreinos de f1 = %d, want 2", f.TotalTreinos)
		}
		if f.ID == f3.ID && f.TotalTreinos != 0 {
			t.Errorf("TotalTreinos de f3 = %d, want 0", f.TotalTreinos)
		}
	}

	porAluno, _ := e.repos.Fichas.List(e.ctx, domain.ListFichasFilter{PersonalID: p, AlunoID: &a1})
	if !igual(ids(porAluno), []uuid.UUID{f2.ID, f1.ID}) {
		t.Errorf("filtro aluno: %v", ids(porAluno))
	}
	ativas, _ := e.repos.Fichas.List(e.ctx, domain.ListFichasFilter{PersonalID: p, Ativa: boolp(true)})
	if !igual(ids(ativas), []uuid.UUID{f3.ID, f1.ID}) {
		t.Errorf("filtro ativa: %v", ids(ativas))
	}
	inativasDoAluno, _ := e.repos.Fichas.List(e.ctx, domain.ListFichasFilter{PersonalID: p, AlunoID: &a1, Ativa: boolp(false)})
	if !igual(ids(inativasDoAluno), []uuid.UUID{f2.ID}) {
		t.Errorf("filtro combinado: %v", ids(inativasDoAluno))
	}

	vazio, err := e.repos.Fichas.List(e.ctx, domain.ListFichasFilter{PersonalID: uuid.New()})
	if err != nil || vazio == nil || len(vazio) != 0 {
		t.Errorf("sem fichas: deve ser slice vazio nao nulo, got %#v err=%v", vazio, err)
	}
}

func TestFicha_FindAtivaByAluno_RespeitaVigenciaEAtiva(t *testing.T) {
	e := novoEnv(t)
	p := e.personal()
	a := e.aluno(p)

	if _, err := e.repos.Fichas.FindAtivaByAluno(e.ctx, a); !errors.Is(err, domain.ErrSemFichaAtiva) {
		t.Fatalf("sem fichas: got %v, want ErrSemFichaAtiva", err)
	}

	fimOntem := e.dias(-1)
	e.ficha(p, a, "futura", e.dias(1), nil, true)
	e.ficha(p, a, "expirada", e.dias(-30), &fimOntem, true)
	e.ficha(p, a, "inativa", e.dias(-5), nil, false)
	if _, err := e.repos.Fichas.FindAtivaByAluno(e.ctx, a); !errors.Is(err, domain.ErrSemFichaAtiva) {
		t.Fatalf("nenhuma vigente: got %v, want ErrSemFichaAtiva", err)
	}

	fimHoje := e.dias(0)
	antiga := e.ficha(p, a, "antiga-vigente", e.dias(-10), &fimHoje, true) // fim == hoje ainda vale
	got, err := e.repos.Fichas.FindAtivaByAluno(e.ctx, a)
	if err != nil || got.ID != antiga.ID {
		t.Fatalf("vigencia_fim == hoje deveria valer: %+v err=%v", got, err)
	}

	recente := e.ficha(p, a, "recente-vigente", e.dias(0), nil, true) // inicio == hoje vale
	got, _ = e.repos.Fichas.FindAtivaByAluno(e.ctx, a)
	if got.ID != recente.ID {
		t.Errorf("com duas vigentes deveria vencer a criada por ultimo, got %q", got.Nome)
	}
}

func TestFicha_UpdateEDeactivate(t *testing.T) {
	e := novoEnv(t)
	p := e.personal()
	a := e.aluno(p)
	f := e.ficha(p, a, "Original", e.dias(0), nil, true)

	fim := e.dias(60)
	f.Nome, f.VigenciaFim, f.Ativa = "Editada", &fim, false
	if err := e.repos.Fichas.Update(e.ctx, f); err != nil {
		t.Fatal(err)
	}
	got, _ := e.repos.Fichas.FindByID(e.ctx, f.ID)
	if got.Nome != "Editada" || got.Ativa || got.VigenciaFim == nil || !got.VigenciaFim.Equal(fim) {
		t.Errorf("Update nao persistiu: %+v", got)
	}

	f.Ativa, f.VigenciaFim = true, nil
	e.must(e.repos.Fichas.Update(e.ctx, f))
	got, _ = e.repos.Fichas.FindByID(e.ctx, f.ID)
	if got.VigenciaFim != nil {
		t.Error("Update com VigenciaFim nil deveria limpar o campo")
	}

	e.must(e.repos.Fichas.Deactivate(e.ctx, f.ID))
	got, _ = e.repos.Fichas.FindByID(e.ctx, f.ID)
	if got.Ativa {
		t.Error("ficha deveria estar inativa")
	}

	if err := e.repos.Fichas.Update(e.ctx, &domain.FichaTreino{ID: uuid.New(), Nome: "x"}); !errors.Is(err, domain.ErrFichaNotFound) {
		t.Errorf("Update inexistente: %v", err)
	}
	if err := e.repos.Fichas.Deactivate(e.ctx, uuid.New()); !errors.Is(err, domain.ErrFichaNotFound) {
		t.Errorf("Deactivate inexistente: %v", err)
	}
}

// ── Treino ─────────────────────────────────────────────────────────────────

func TestTreino_CRUDEUnicidadeDeLetra(t *testing.T) {
	e := novoEnv(t)
	p := e.personal()
	f := e.ficha(p, e.aluno(p), "f", e.dias(0), nil, true)
	outraFicha := e.ficha(p, e.aluno(p), "g", e.dias(0), nil, true)

	b := e.treino(f.ID, "B", 1)
	a := &domain.Treino{ID: uuid.New(), FichaID: f.ID, Letra: "A", Nome: "Peito", Ordem: 0}
	e.must(e.repos.Treinos.Create(e.ctx, a))

	dup := &domain.Treino{ID: uuid.New(), FichaID: f.ID, Letra: "A", Ordem: 5}
	if err := e.repos.Treinos.Create(e.ctx, dup); !errors.Is(err, domain.ErrLetraJaUsada) {
		t.Errorf("letra repetida na mesma ficha: got %v, want ErrLetraJaUsada", err)
	}
	// A mesma letra em OUTRA ficha e permitida.
	e.treino(outraFicha.ID, "A", 0)

	lista, err := e.repos.Treinos.ListByFicha(e.ctx, f.ID)
	if err != nil || len(lista) != 2 || lista[0].Letra != "A" || lista[1].Letra != "B" {
		t.Fatalf("ListByFicha ordem (ordem, letra): %+v err=%v", lista, err)
	}
	if lista[0].Nome != "Peito" || lista[1].Nome != "" {
		t.Errorf("nome opcional: %q / %q", lista[0].Nome, lista[1].Nome)
	}

	// Update: trocar a letra de B para A colide; trocar para C funciona.
	b.Letra = "A"
	if err := e.repos.Treinos.Update(e.ctx, b); !errors.Is(err, domain.ErrLetraJaUsada) {
		t.Errorf("update para letra existente: got %v", err)
	}
	b.Letra, b.Nome = "C", "Costas"
	e.must(e.repos.Treinos.Update(e.ctx, b))
	got, _ := e.repos.Treinos.FindByID(e.ctx, b.ID)
	if got.Letra != "C" || got.Nome != "Costas" {
		t.Errorf("update nao persistiu: %+v", got)
	}

	if _, err := e.repos.Treinos.FindByID(e.ctx, uuid.New()); !errors.Is(err, domain.ErrTreinoNotFound) {
		t.Errorf("FindByID inexistente: %v", err)
	}
	if err := e.repos.Treinos.Update(e.ctx, &domain.Treino{ID: uuid.New(), Letra: "Z"}); !errors.Is(err, domain.ErrTreinoNotFound) {
		t.Errorf("Update inexistente: %v", err)
	}

	e.must(e.repos.Treinos.Delete(e.ctx, a.ID))
	if err := e.repos.Treinos.Delete(e.ctx, a.ID); !errors.Is(err, domain.ErrTreinoNotFound) {
		t.Errorf("Delete repetido: %v", err)
	}
}

func TestTreino_DeleteRemoveOsItensEmCascata(t *testing.T) {
	e := novoEnv(t)
	p := e.personal()
	f := e.ficha(p, e.aluno(p), "f", e.dias(0), nil, true)
	tr := e.treino(f.ID, "A", 0)
	it := e.item(tr.ID, e.exercicio("Supino", nil), 0)

	e.must(e.repos.Treinos.Delete(e.ctx, tr.ID))

	if _, err := e.repos.Itens.FindByID(e.ctx, it.ID); !errors.Is(err, domain.ErrItemTreinoNotFound) {
		t.Errorf("item deveria ter sido removido em cascata, got %v", err)
	}
}

func TestTreino_DeleteComSessaoRegistradaEBloqueado(t *testing.T) {
	e := novoEnv(t)
	p := e.personal()
	a := e.aluno(p)
	f := e.ficha(p, a, "f", e.dias(0), nil, true)
	tr := e.treino(f.ID, "A", 0)
	e.sessao(a, tr.ID, e.dias(0), "CONCLUIDO", nil)

	err := e.repos.Treinos.Delete(e.ctx, tr.ID)

	if err == nil || errors.Is(err, domain.ErrTreinoNotFound) {
		t.Errorf("ON DELETE RESTRICT de sessao_treino deveria barrar a exclusao, got %v", err)
	}
	if _, err := e.repos.Treinos.FindByID(e.ctx, tr.ID); err != nil {
		t.Errorf("treino nao deveria ter sido removido: %v", err)
	}
}

// ── ItemTreino ─────────────────────────────────────────────────────────────

func TestItem_CRUD(t *testing.T) {
	e := novoEnv(t)
	p := e.personal()
	tr := e.treino(e.ficha(p, e.aluno(p), "f", e.dias(0), nil, true).ID, "A", 0)
	ex1, ex2 := e.exercicio("Supino", nil), e.exercicio("Crucifixo", nil)

	carga, descanso := 42.5, 90
	i2 := &domain.ItemTreino{
		ID: uuid.New(), TreinoID: tr.ID, ExercicioID: ex2, Ordem: 1, Series: 4, Repeticoes: "8-12",
		CargaSugerida: &carga, DescansoSegundos: &descanso, Observacao: "cotovelos fechados",
	}
	e.must(e.repos.Itens.Create(e.ctx, i2))
	i1 := e.item(tr.ID, ex1, 0)

	got, err := e.repos.Itens.FindByID(e.ctx, i2.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Series != 4 || got.Repeticoes != "8-12" || got.CargaSugerida == nil || *got.CargaSugerida != 42.5 ||
		got.DescansoSegundos == nil || *got.DescansoSegundos != 90 || got.Observacao != "cotovelos fechados" {
		t.Errorf("item inesperado: %+v", got)
	}
	got1, _ := e.repos.Itens.FindByID(e.ctx, i1.ID)
	if got1.CargaSugerida != nil || got1.DescansoSegundos != nil || got1.Observacao != "" {
		t.Errorf("opcionais ausentes deveriam voltar nulos/vazios: %+v", got1)
	}

	lista, _ := e.repos.Itens.ListByTreino(e.ctx, tr.ID)
	if len(lista) != 2 || lista[0].ID != i1.ID || lista[1].ID != i2.ID {
		t.Errorf("ListByTreino deve ordenar por ordem: %+v", lista)
	}

	i2.Series, i2.Observacao, i2.CargaSugerida = 5, "", nil
	e.must(e.repos.Itens.Update(e.ctx, i2))
	got, _ = e.repos.Itens.FindByID(e.ctx, i2.ID)
	if got.Series != 5 || got.Observacao != "" || got.CargaSugerida != nil {
		t.Errorf("update nao persistiu/limpou: %+v", got)
	}

	if _, err := e.repos.Itens.FindByID(e.ctx, uuid.New()); !errors.Is(err, domain.ErrItemTreinoNotFound) {
		t.Errorf("FindByID inexistente: %v", err)
	}
	if err := e.repos.Itens.Update(e.ctx, &domain.ItemTreino{ID: uuid.New(), Repeticoes: "1"}); !errors.Is(err, domain.ErrItemTreinoNotFound) {
		t.Errorf("Update inexistente: %v", err)
	}
	e.must(e.repos.Itens.Delete(e.ctx, i1.ID))
	if err := e.repos.Itens.Delete(e.ctx, i1.ID); !errors.Is(err, domain.ErrItemTreinoNotFound) {
		t.Errorf("Delete repetido: %v", err)
	}

	semFK := &domain.ItemTreino{ID: uuid.New(), TreinoID: tr.ID, ExercicioID: uuid.New(), Series: 1, Repeticoes: "1"}
	if err := e.repos.Itens.Create(e.ctx, semFK); err == nil {
		t.Error("exercicio inexistente deveria violar a FK")
	}
}

func TestItem_Reorder(t *testing.T) {
	e := novoEnv(t)
	p := e.personal()
	tr := e.treino(e.ficha(p, e.aluno(p), "f", e.dias(0), nil, true).ID, "A", 0)
	outro := e.treino(e.ficha(p, e.aluno(p), "g", e.dias(0), nil, true).ID, "A", 0)
	ex := e.exercicio("Ex", nil)
	a, b, c := e.item(tr.ID, ex, 0), e.item(tr.ID, ex, 1), e.item(tr.ID, ex, 2)
	alheio := e.item(outro.ID, ex, 0)

	ordemAtual := func() []uuid.UUID {
		lista, _ := e.repos.Itens.ListByTreino(e.ctx, tr.ID)
		out := make([]uuid.UUID, len(lista))
		for i, it := range lista {
			out[i] = it.ID
		}
		return out
	}

	t.Run("aplica a nova ordem", func(t *testing.T) {
		e.must(e.repos.Itens.Reorder(e.ctx, tr.ID, []uuid.UUID{c.ID, a.ID, b.ID}))
		if !igual(ordemAtual(), []uuid.UUID{c.ID, a.ID, b.ID}) {
			t.Errorf("ordem = %v", ordemAtual())
		}
	})

	t.Run("id de outro treino: erro e NENHUMA alteracao parcial", func(t *testing.T) {
		antes := ordemAtual()
		err := e.repos.Itens.Reorder(e.ctx, tr.ID, []uuid.UUID{b.ID, alheio.ID, a.ID})
		if !errors.Is(err, domain.ErrReorderInconsistente) {
			t.Fatalf("got %v, want ErrReorderInconsistente", err)
		}
		if !igual(ordemAtual(), antes) {
			t.Errorf("ordem mudou apesar do erro: %v -> %v", antes, ordemAtual())
		}
		got, _ := e.repos.Itens.FindByID(e.ctx, alheio.ID)
		if got.Ordem != 0 {
			t.Errorf("item de outro treino foi alterado: ordem=%d", got.Ordem)
		}
	})

	t.Run("id inexistente", func(t *testing.T) {
		if err := e.repos.Itens.Reorder(e.ctx, tr.ID, []uuid.UUID{a.ID, uuid.New()}); !errors.Is(err, domain.ErrReorderInconsistente) {
			t.Errorf("got %v", err)
		}
	})

	t.Run("id repetido na lista", func(t *testing.T) {
		antes := ordemAtual()
		if err := e.repos.Itens.Reorder(e.ctx, tr.ID, []uuid.UUID{a.ID, a.ID}); !errors.Is(err, domain.ErrReorderInconsistente) {
			t.Errorf("got %v", err)
		}
		if !igual(ordemAtual(), antes) {
			t.Error("lista com duplicata nao pode alterar a ordem")
		}
	})
}

// ── FichaCompleta ──────────────────────────────────────────────────────────

func TestFichaCompleta(t *testing.T) {
	e := novoEnv(t)
	p := e.personal()
	f := e.ficha(p, e.aluno(p), "Completa", e.dias(0), nil, true)
	tB := e.treino(f.ID, "B", 1)
	tA := e.treino(f.ID, "A", 0)
	tVazio := e.treino(f.ID, "C", 2)
	global := e.exercicio("Agachamento", nil)
	proprio := e.exercicio("Meu exercicio", &p)
	e.item(tA.ID, proprio, 1)
	e.item(tA.ID, global, 0)
	e.item(tB.ID, global, 0)

	got, err := e.repos.FichaCompleta.GetCompleta(e.ctx, f.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Ficha.ID != f.ID || len(got.Treinos) != 3 {
		t.Fatalf("ficha/treinos inesperados: %+v", got)
	}
	if got.Treinos[0].Treino.ID != tA.ID || got.Treinos[1].Treino.ID != tB.ID || got.Treinos[2].Treino.ID != tVazio.ID {
		t.Errorf("treinos deveriam vir por (ordem, letra)")
	}

	itensA := got.Treinos[0].Itens
	if len(itensA) != 2 || itensA[0].ExercicioNome != "Agachamento" || itensA[1].ExercicioNome != "Meu exercicio" {
		t.Fatalf("itens de A: %+v", itensA)
	}
	if !itensA[0].ExercicioIsGlobal || itensA[1].ExercicioIsGlobal {
		t.Errorf("is_global: global=%v proprio=%v", itensA[0].ExercicioIsGlobal, itensA[1].ExercicioIsGlobal)
	}
	if itensA[0].GrupoMuscularID != e.grupo || itensA[0].GrupoMuscularNome == "" {
		t.Errorf("grupo muscular nao veio do JOIN: %+v", itensA[0])
	}
	if len(got.Treinos[2].Itens) != 0 {
		t.Errorf("treino sem itens deveria ter lista vazia, got %d", len(got.Treinos[2].Itens))
	}

	if _, err := e.repos.FichaCompleta.GetCompleta(e.ctx, uuid.New()); !errors.Is(err, domain.ErrFichaNotFound) {
		t.Errorf("inexistente: %v", err)
	}

	semTreinos := e.ficha(p, e.aluno(p), "Vazia", e.dias(0), nil, true)
	c, err := e.repos.FichaCompleta.GetCompleta(e.ctx, semTreinos.ID)
	if err != nil || len(c.Treinos) != 0 {
		t.Errorf("ficha sem treinos: %+v err=%v", c, err)
	}
}

// ── TreinoHoje (rotacao A -> B -> C -> A) ─────────────────────────────────

func TestTreinoHoje_Rotacao(t *testing.T) {
	e := novoEnv(t)
	p := e.personal()
	a := e.aluno(p)
	ex := e.exercicio("Ex", nil)

	t.Run("sem ficha ativa", func(t *testing.T) {
		if _, err := e.repos.TreinoHoje.GetTreinoHoje(e.ctx, a); !errors.Is(err, domain.ErrSemFichaAtiva) {
			t.Errorf("got %v, want ErrSemFichaAtiva", err)
		}
	})

	f := e.ficha(p, a, "ABC", e.dias(-7), nil, true)

	t.Run("ficha sem treinos", func(t *testing.T) {
		if _, err := e.repos.TreinoHoje.GetTreinoHoje(e.ctx, a); !errors.Is(err, domain.ErrSemTreinoHoje) {
			t.Errorf("got %v, want ErrSemTreinoHoje", err)
		}
	})

	// Criados fora de ordem de proposito: a sequencia segue (ordem, letra).
	tC := e.treino(f.ID, "C", 2)
	tA := e.treino(f.ID, "A", 0)
	tB := e.treino(f.ID, "B", 1)
	e.item(tA.ID, ex, 0)

	hoje := func() string {
		t.Helper()
		got, err := e.repos.TreinoHoje.GetTreinoHoje(e.ctx, a)
		if err != nil {
			t.Fatalf("GetTreinoHoje: %v", err)
		}
		return got.Treino.Letra
	}

	t.Run("nunca treinou: comeca pelo primeiro e carrega os itens", func(t *testing.T) {
		got, _ := e.repos.TreinoHoje.GetTreinoHoje(e.ctx, a)
		if got.Treino.Letra != "A" || len(got.Itens) != 1 || got.Itens[0].ExercicioNome != "Ex" {
			t.Errorf("got %+v", got)
		}
	})

	agora := time.Now()
	t.Run("apos concluir A vem B", func(t *testing.T) {
		e.sessao(a, tA.ID, e.dias(-3), "CONCLUIDO", &agora)
		if l := hoje(); l != "B" {
			t.Errorf("got %s, want B", l)
		}
	})

	t.Run("apos concluir B vem C", func(t *testing.T) {
		e.sessao(a, tB.ID, e.dias(-2), "CONCLUIDO", &agora)
		if l := hoje(); l != "C" {
			t.Errorf("got %s, want C", l)
		}
	})

	t.Run("sessoes nao concluidas nao avancam a sequencia", func(t *testing.T) {
		e.sessao(a, tC.ID, e.dias(-1), "EM_ANDAMENTO", nil)
		e.sessao(a, tC.ID, e.dias(-1), "ABANDONADO", nil)
		if l := hoje(); l != "C" {
			t.Errorf("got %s, want C", l)
		}
	})

	t.Run("apos concluir o ultimo volta ao primeiro", func(t *testing.T) {
		e.sessao(a, tC.ID, e.dias(0), "CONCLUIDO", &agora)
		if l := hoje(); l != "A" {
			t.Errorf("got %s, want A", l)
		}
	})

	t.Run("desempata sessoes do mesmo dia por concluido_em", func(t *testing.T) {
		// Duas concluidas hoje: A mais cedo, B mais tarde => a ultima e B => proximo C.
		a2 := e.aluno(p)
		f2 := e.ficha(p, a2, "AB2", e.dias(-1), nil, true)
		x := e.treino(f2.ID, "A", 0)
		y := e.treino(f2.ID, "B", 1)
		z := e.treino(f2.ID, "C", 2)
		_ = z
		cedo, tarde := agora.Add(-3*time.Hour), agora.Add(-1*time.Hour)
		e.sessao(a2, y.ID, e.dias(0), "CONCLUIDO", &tarde)
		e.sessao(a2, x.ID, e.dias(0), "CONCLUIDO", &cedo)
		got, err := e.repos.TreinoHoje.GetTreinoHoje(e.ctx, a2)
		if err != nil || got.Treino.Letra != "C" {
			t.Errorf("got %v err=%v, want C", got, err)
		}
	})

	t.Run("sessoes de OUTRA ficha do aluno sao ignoradas", func(t *testing.T) {
		a3 := e.aluno(p)
		antiga := e.ficha(p, a3, "antiga", e.dias(-30), nil, false)
		tAntigo := e.treino(antiga.ID, "B", 1)
		e.treino(antiga.ID, "A", 0)
		e.sessao(a3, tAntigo.ID, e.dias(-10), "CONCLUIDO", &agora)

		atual := e.ficha(p, a3, "atual", e.dias(-1), nil, true)
		e.treino(atual.ID, "A", 0)
		e.treino(atual.ID, "B", 1)

		got, err := e.repos.TreinoHoje.GetTreinoHoje(e.ctx, a3)
		if err != nil || got.Treino.Letra != "A" {
			t.Errorf("a ficha nova deveria comecar do A, got %v err=%v", got, err)
		}
	})
}

// ── Lookups cross-context ──────────────────────────────────────────────────

func TestAlunoLookup_BelongsToPersonal(t *testing.T) {
	e := novoEnv(t)
	p, outro := e.personal(), e.personal()
	a := e.aluno(p)
	inativo := e.aluno(p)
	e.exec(`UPDATE aluno SET ativo = FALSE WHERE id = $1`, inativo)

	casos := []struct {
		nome         string
		aluno, owner uuid.UUID
		want         bool
	}{
		{"aluno ativo do personal", a, p, true},
		{"aluno de outro personal", a, outro, false},
		{"aluno inativo", inativo, p, false},
		{"aluno inexistente", uuid.New(), p, false},
	}
	for _, c := range casos {
		got, err := e.repos.AlunoLookup.BelongsToPersonal(e.ctx, c.aluno, c.owner)
		if err != nil || got != c.want {
			t.Errorf("%s: got %v err=%v, want %v", c.nome, got, err, c.want)
		}
	}
}

func TestSessaoHojeLookup(t *testing.T) {
	e := novoEnv(t)
	p := e.personal()
	a := e.aluno(p)
	tr := e.treino(e.ficha(p, a, "f", e.dias(-1), nil, true).ID, "A", 0)
	outroTreino := e.treino(e.ficha(p, a, "g", e.dias(-1), nil, true).ID, "A", 0)

	got, err := e.repos.SessaoHoje.FindEmAndamentoHojeID(e.ctx, a, tr.ID)
	if err != nil || got != nil {
		t.Fatalf("sem sessoes: got %v err=%v, want nil,nil", got, err)
	}

	e.sessao(a, tr.ID, e.dias(-1), "EM_ANDAMENTO", nil) // ontem: ignora
	e.sessao(a, tr.ID, e.dias(0), "CONCLUIDO", nil)     // concluida: ignora
	e.sessao(a, outroTreino.ID, e.dias(0), "EM_ANDAMENTO", nil)
	if got, _ := e.repos.SessaoHoje.FindEmAndamentoHojeID(e.ctx, a, tr.ID); got != nil {
		t.Errorf("nenhuma sessao em andamento de hoje para este treino, got %v", got)
	}

	id := e.sessao(a, tr.ID, e.dias(0), "EM_ANDAMENTO", nil)
	got, err = e.repos.SessaoHoje.FindEmAndamentoHojeID(e.ctx, a, tr.ID)
	if err != nil || got == nil || *got != id {
		t.Errorf("got %v err=%v, want %s", got, err, id)
	}
}

// ── Templates ──────────────────────────────────────────────────────────────

// templatePersonal insere um template custom (criado_por=PERSONAL) com itens.
func (e *env) template(nome, nivel, objetivo string, personal *uuid.UUID, ativo bool, itens ...[2]any) uuid.UUID {
	id := uuid.New()
	origem := "SISTEMA"
	if personal != nil {
		origem = "PERSONAL"
	}
	e.exec(`INSERT INTO template_treino (id, nome, nivel, objetivo, criado_por, personal_id, ativo)
	        VALUES ($1, $2, $3::nivel_anamnese, $4, $5::origem_template, $6, $7)`,
		id, nome, nivel, objetivo, origem, personal, ativo)
	for ordem, it := range itens {
		e.exec(`INSERT INTO template_item (id, template_id, exercicio_id, treino_letra, ordem, series, repeticoes)
		        VALUES ($1, $2, $3, $4, $5, 3, '10')`, uuid.New(), id, it[0], it[1], ordem)
	}
	return id
}

func TestTemplates_List_VisibilidadeFiltrosEOrdem(t *testing.T) {
	e := novoEnv(t)
	p, outro := e.personal(), e.personal()
	ex := e.exercicio("Ex", nil)
	const obj = "objetivo-de-teste"

	sistema := e.template("Sistema", "INICIANTE", obj, nil, true, [2]any{ex, "A"})
	meu := e.template("Meu", "INICIANTE", obj, &p, true, [2]any{ex, "B"}, [2]any{ex, "A"})
	e.template("Alheio", "INICIANTE", obj, &outro, true)
	e.template("Inativo", "INICIANTE", obj, nil, false)
	e.template("Outro nivel", "AVANCADO", obj, nil, true)

	nivel, objetivo := "INICIANTE", obj
	got, err := e.repos.Templates.List(e.ctx, domain.ListTemplatesFilter{PersonalID: p, Nivel: &nivel, Objetivo: &objetivo})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0].Template.ID != meu || got[1].Template.ID != sistema {
		t.Fatalf("esperado [meu, sistema] (custom do personal primeiro; sem alheio/inativo/outro nivel), got %+v", got)
	}
	if got[0].Template.CriadoPor != domain.OrigemTemplatePersonal || got[0].Template.PersonalID == nil || *got[0].Template.PersonalID != p {
		t.Errorf("origem/personal do custom: %+v", got[0].Template)
	}
	if got[1].Template.CriadoPor != domain.OrigemTemplateSistema || got[1].Template.PersonalID != nil {
		t.Errorf("origem/personal do sistema: %+v", got[1].Template)
	}
	// Itens ordenados por (treino_letra, ordem).
	if len(got[0].Itens) != 2 || got[0].Itens[0].TreinoLetra != "A" || got[0].Itens[1].TreinoLetra != "B" {
		t.Errorf("itens do custom: %+v", got[0].Itens)
	}

	// Sem filtros: inclui as seeds globais + os do personal, nunca os de outro.
	todos, _ := e.repos.Templates.List(e.ctx, domain.ListTemplatesFilter{PersonalID: p})
	for _, tc := range todos {
		if tc.Template.PersonalID != nil && *tc.Template.PersonalID != p {
			t.Errorf("vazou template de outro personal: %+v", tc.Template)
		}
		if !tc.Template.Ativo {
			t.Errorf("template inativo listado: %+v", tc.Template)
		}
	}
	if len(todos) < 3 {
		t.Errorf("deveria incluir ao menos as 3 seeds globais, got %d", len(todos))
	}
}

func TestTemplates_MelhorMatch(t *testing.T) {
	e := novoEnv(t)
	p, outro := e.personal(), e.personal()
	ex := e.exercicio("Ex", nil)
	const obj = "match-teste"

	got, err := e.repos.Templates.MelhorMatch(e.ctx, p, "INTERMEDIARIO", obj)
	if err != nil || got != nil {
		t.Fatalf("sem match: got %v err=%v, want nil,nil", got, err)
	}

	sistema := e.template("Sistema", "INTERMEDIARIO", obj, nil, true, [2]any{ex, "A"})
	e.template("Alheio", "INTERMEDIARIO", obj, &outro, true)
	got, _ = e.repos.Templates.MelhorMatch(e.ctx, p, "INTERMEDIARIO", obj)
	if got == nil || got.ID != sistema {
		t.Fatalf("deveria cair no template do sistema (o do outro personal e invisivel), got %+v", got)
	}

	meu := e.template("Meu", "INTERMEDIARIO", obj, &p, true, [2]any{ex, "A"})
	got, _ = e.repos.Templates.MelhorMatch(e.ctx, p, "INTERMEDIARIO", obj)
	if got == nil || got.ID != meu {
		t.Errorf("template custom deveria ter prioridade sobre o do sistema, got %+v", got)
	}

	if g, _ := e.repos.Templates.MelhorMatch(e.ctx, p, "AVANCADO", obj); g != nil {
		t.Errorf("nivel diferente nao deveria casar: %+v", g)
	}
}

func TestTemplates_AplicarTemplate(t *testing.T) {
	e := novoEnv(t)
	p, outro := e.personal(), e.personal()
	a := e.aluno(p)
	ex1, ex2 := e.exercicio("Supino", nil), e.exercicio("Remada", nil)
	tpl := e.template("Modelo AB", "INICIANTE", "aplicar", &p, true,
		[2]any{ex1, "A"}, [2]any{ex2, "A"}, [2]any{ex2, "B"})

	inicio := e.dias(0)

	t.Run("cria ficha, um treino por letra e copia os itens", func(t *testing.T) {
		got, err := e.repos.Templates.AplicarTemplate(e.ctx, tpl, a, p, "", inicio)
		if err != nil {
			t.Fatal(err)
		}
		if got.Ficha.Nome != "Modelo AB" || !got.Ficha.Ativa || got.Ficha.AlunoID != a || got.Ficha.PersonalID != p {
			t.Errorf("ficha: %+v", got.Ficha)
		}
		if len(got.Treinos) != 2 || got.Treinos[0].Treino.Letra != "A" || got.Treinos[1].Treino.Letra != "B" {
			t.Fatalf("treinos: %+v", got.Treinos)
		}
		if got.Treinos[0].Treino.Ordem != 0 || got.Treinos[1].Treino.Ordem != 1 {
			t.Errorf("ordem dos treinos: %d, %d", got.Treinos[0].Treino.Ordem, got.Treinos[1].Treino.Ordem)
		}
		if len(got.Treinos[0].Itens) != 2 || len(got.Treinos[1].Itens) != 1 {
			t.Errorf("itens: A=%d B=%d", len(got.Treinos[0].Itens), len(got.Treinos[1].Itens))
		}
	})

	t.Run("nome informado prevalece sobre o do template", func(t *testing.T) {
		got, err := e.repos.Templates.AplicarTemplate(e.ctx, tpl, a, p, "Minha ficha", inicio)
		if err != nil || got.Ficha.Nome != "Minha ficha" {
			t.Errorf("got %+v err=%v", got, err)
		}
	})

	t.Run("template de outro personal: ErrTemplateNotFound e nada e criado", func(t *testing.T) {
		alheio := e.template("Alheio", "INICIANTE", "aplicar", &outro, true, [2]any{ex1, "A"})
		var antes int
		e.must(e.pool.QueryRow(e.ctx, `SELECT COUNT(*) FROM ficha_treino`).Scan(&antes))

		_, err := e.repos.Templates.AplicarTemplate(e.ctx, alheio, a, p, "", inicio)

		if !errors.Is(err, domain.ErrTemplateNotFound) {
			t.Fatalf("got %v", err)
		}
		var depois int
		e.must(e.pool.QueryRow(e.ctx, `SELECT COUNT(*) FROM ficha_treino`).Scan(&depois))
		if depois != antes {
			t.Errorf("fichas: %d -> %d", antes, depois)
		}
	})

	t.Run("template inativo ou inexistente: ErrTemplateNotFound", func(t *testing.T) {
		inativo := e.template("Inativo", "INICIANTE", "aplicar", &p, false, [2]any{ex1, "A"})
		if _, err := e.repos.Templates.AplicarTemplate(e.ctx, inativo, a, p, "", inicio); !errors.Is(err, domain.ErrTemplateNotFound) {
			t.Errorf("inativo: %v", err)
		}
		if _, err := e.repos.Templates.AplicarTemplate(e.ctx, uuid.New(), a, p, "", inicio); !errors.Is(err, domain.ErrTemplateNotFound) {
			t.Errorf("inexistente: %v", err)
		}
	})

	t.Run("template sem itens: ErrTemplateSemItens", func(t *testing.T) {
		vazio := e.template("Vazio", "INICIANTE", "aplicar", &p, true)
		if _, err := e.repos.Templates.AplicarTemplate(e.ctx, vazio, a, p, "", inicio); !errors.Is(err, domain.ErrTemplateSemItens) {
			t.Errorf("got %v", err)
		}
	})
}

func TestTemplates_CriarFromFicha(t *testing.T) {
	e := novoEnv(t)
	p := e.personal()
	a := e.aluno(p)
	ex1, ex2 := e.exercicio("Supino", nil), e.exercicio("Remada", nil)
	f := e.ficha(p, a, "Origem", e.dias(0), nil, true)
	// Letras em ordem "invertida" de proposito: a ordem real do treino manda.
	tZ := e.treino(f.ID, "Z", 0)
	tA := e.treino(f.ID, "A", 1)
	e.item(tZ.ID, ex1, 0)
	e.item(tZ.ID, ex2, 1)
	e.item(tA.ID, ex2, 0)

	t.Run("copia treinos e itens para um template do personal", func(t *testing.T) {
		got, err := e.repos.Templates.CriarFromFicha(e.ctx, f.ID, p, "Meu modelo", "INTERMEDIARIO", "hipertrofia")
		if err != nil {
			t.Fatal(err)
		}
		if got.Template.Nome != "Meu modelo" || got.Template.CriadoPor != domain.OrigemTemplatePersonal ||
			got.Template.PersonalID == nil || *got.Template.PersonalID != p || !got.Template.Ativo {
			t.Errorf("template: %+v", got.Template)
		}
		if len(got.Itens) != 3 || got.Itens[0].TreinoLetra != "Z" || got.Itens[2].TreinoLetra != "A" {
			t.Errorf("itens na ordem dos treinos da ficha: %+v", got.Itens)
		}

		// Persistiu de verdade: aparece no List do personal e nao no de outro.
		lista, _ := e.repos.Templates.List(e.ctx, domain.ListTemplatesFilter{PersonalID: p})
		achou := false
		for _, tc := range lista {
			if tc.Template.ID == got.Template.ID {
				achou = len(tc.Itens) == 3
			}
		}
		if !achou {
			t.Error("template salvo deveria aparecer no List do personal com 3 itens")
		}
		visivelParaOutro, _ := e.repos.Templates.List(e.ctx, domain.ListTemplatesFilter{PersonalID: e.personal()})
		for _, tc := range visivelParaOutro {
			if tc.Template.ID == got.Template.ID {
				t.Error("template custom vazou para outro personal")
			}
		}
	})

	t.Run("ficha sem itens: ErrFichaSemItens e nenhum template e criado", func(t *testing.T) {
		vazia := e.ficha(p, a, "Vazia", e.dias(0), nil, true)
		e.treino(vazia.ID, "A", 0)
		var antes int
		e.must(e.pool.QueryRow(e.ctx, `SELECT COUNT(*) FROM template_treino`).Scan(&antes))

		_, err := e.repos.Templates.CriarFromFicha(e.ctx, vazia.ID, p, "x", "INICIANTE", "forca")

		if !errors.Is(err, domain.ErrFichaSemItens) {
			t.Fatalf("got %v", err)
		}
		var depois int
		e.must(e.pool.QueryRow(e.ctx, `SELECT COUNT(*) FROM template_treino`).Scan(&depois))
		if depois != antes {
			t.Errorf("templates: %d -> %d", antes, depois)
		}
	})

	t.Run("nivel invalido falha e faz rollback", func(t *testing.T) {
		var antes int
		e.must(e.pool.QueryRow(e.ctx, `SELECT COUNT(*) FROM template_treino`).Scan(&antes))

		_, err := e.repos.Templates.CriarFromFicha(e.ctx, f.ID, p, "x", "NIVEL_INEXISTENTE", "forca")

		if err == nil {
			t.Fatal("nivel fora do enum deveria falhar")
		}
		var depois int
		e.must(e.pool.QueryRow(e.ctx, `SELECT COUNT(*) FROM template_treino`).Scan(&depois))
		if depois != antes {
			t.Errorf("templates: %d -> %d", antes, depois)
		}
	})
}
