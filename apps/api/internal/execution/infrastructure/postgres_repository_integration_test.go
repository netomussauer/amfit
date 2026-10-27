//go:build integration

package infrastructure_test

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/amfit/api/internal/execution/domain"
	"github.com/amfit/api/internal/execution/infrastructure"
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

// cenario cria personal, aluno, ficha vigente e um treino A com um item de 3 series.
type cenario struct {
	personal, aluno, ficha, treino, item uuid.UUID
}

func (e *env) cenario() cenario {
	c := cenario{personal: e.Personal()}
	c.aluno = e.Aluno(c.personal)
	c.ficha = e.FichaVigente(c.personal, c.aluno)
	c.treino = e.Treino(c.ficha, "A", 0)
	c.item = e.Item(c.treino, e.Exercicio("Supino", nil), 0, 3)
	return c
}

func (e *env) novaSessao(c cenario, data time.Time) *domain.SessaoTreino {
	s := &domain.SessaoTreino{
		ID: uuid.New(), AlunoID: c.aluno, TreinoID: c.treino, DataExecucao: data,
		Status: domain.StatusEmAndamento, IniciadoEm: time.Now(),
	}
	if err := e.repos.Sessoes.Create(e.Ctx, s); err != nil {
		e.T.Fatalf("criar sessao: %v", err)
	}
	return s
}

// ── Sessoes ────────────────────────────────────────────────────────────────

func TestSessao_CreateEFindByID(t *testing.T) {
	e := novoEnv(t)
	c := e.cenario()

	s := &domain.SessaoTreino{
		ID: uuid.New(), AlunoID: c.aluno, TreinoID: c.treino, DataExecucao: e.Dias(0),
		Status: domain.StatusEmAndamento, IniciadoEm: time.Now(), Observacao: "dor no ombro",
	}
	if err := e.repos.Sessoes.Create(e.Ctx, s); err != nil {
		t.Fatal(err)
	}

	got, err := e.repos.Sessoes.FindByID(e.Ctx, s.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.AlunoID != c.aluno || got.TreinoID != c.treino || got.Status != domain.StatusEmAndamento ||
		got.Observacao != "dor no ombro" || got.ConcluidoEm != nil || !got.DataExecucao.Equal(e.Dias(0)) {
		t.Errorf("sessao inesperada: %+v", got)
	}

	semObs := e.novaSessao(c, e.Dias(-1))
	got, _ = e.repos.Sessoes.FindByID(e.Ctx, semObs.ID)
	if got.Observacao != "" {
		t.Errorf("observacao vazia deveria voltar vazia, got %q", got.Observacao)
	}

	if _, err := e.repos.Sessoes.FindByID(e.Ctx, uuid.New()); !errors.Is(err, domain.ErrSessaoNotFound) {
		t.Errorf("inexistente: %v", err)
	}
}

func TestSessao_CreateOrResumeEmAndamento(t *testing.T) {
	e := novoEnv(t)
	c := e.cenario()
	outroTreino := e.Treino(e.Ficha(c.personal, e.Aluno(c.personal), e.Dias(-1), nil, true), "A", 0)

	nova := func(treino uuid.UUID) *domain.SessaoTreino {
		return &domain.SessaoTreino{
			ID: uuid.New(), AlunoID: c.aluno, TreinoID: treino, DataExecucao: e.Dias(0),
			Status: domain.StatusEmAndamento, IniciadoEm: time.Now(),
		}
	}

	primeira, created, err := e.repos.Sessoes.CreateOrResumeEmAndamento(e.Ctx, nova(c.treino))
	if err != nil || !created {
		t.Fatalf("primeira chamada: created=%v err=%v", created, err)
	}

	// Segunda chamada para o mesmo (aluno, treino) no mesmo dia: retoma a existente.
	segunda, created, err := e.repos.Sessoes.CreateOrResumeEmAndamento(e.Ctx, nova(c.treino))
	if err != nil || created || segunda.ID != primeira.ID {
		t.Errorf("deveria retomar %s: created=%v id=%v err=%v", primeira.ID, created, segunda, err)
	}

	// Outro treino do mesmo aluno e uma sessao independente.
	outra, created, err := e.repos.Sessoes.CreateOrResumeEmAndamento(e.Ctx, nova(outroTreino))
	if err != nil || !created || outra.ID == primeira.ID {
		t.Errorf("outro treino: created=%v id=%v err=%v", created, outra, err)
	}

	// Depois de concluida, uma nova chamada cria outra sessao (so EM_ANDAMENTO e retomada).
	fim := time.Now().UTC()
	if _, err := e.repos.Sessoes.UpdateStatus(e.Ctx, primeira.ID, domain.StatusConcluido, &fim); err != nil {
		t.Fatal(err)
	}
	terceira, created, err := e.repos.Sessoes.CreateOrResumeEmAndamento(e.Ctx, nova(c.treino))
	if err != nil || !created || terceira.ID == primeira.ID {
		t.Errorf("apos concluir deveria criar nova sessao: created=%v id=%v err=%v", created, terceira, err)
	}
}

func TestSessao_FindEmAndamentoHoje(t *testing.T) {
	e := novoEnv(t)
	c := e.cenario()
	outroTreino := e.Treino(c.ficha, "B", 1)
	outroAluno := e.Aluno(c.personal)

	if _, err := e.repos.Sessoes.FindEmAndamentoHoje(e.Ctx, c.aluno, c.treino); !errors.Is(err, domain.ErrSessaoNotFound) {
		t.Fatalf("sem sessoes: %v", err)
	}

	e.Sessao(c.aluno, c.treino, e.Dias(-1), "EM_ANDAMENTO", nil) // ontem
	e.Sessao(c.aluno, c.treino, e.Dias(0), "CONCLUIDO", nil)     // concluida
	e.Sessao(c.aluno, outroTreino, e.Dias(0), "EM_ANDAMENTO", nil)
	e.Sessao(outroAluno, c.treino, e.Dias(0), "EM_ANDAMENTO", nil)
	if _, err := e.repos.Sessoes.FindEmAndamentoHoje(e.Ctx, c.aluno, c.treino); !errors.Is(err, domain.ErrSessaoNotFound) {
		t.Fatalf("nenhuma elegivel: %v", err)
	}

	// Duas em andamento hoje: devolve a de iniciado_em mais recente.
	antiga := e.Sessao(c.aluno, c.treino, e.Dias(0), "EM_ANDAMENTO", nil)
	e.Exec(`UPDATE sessao_treino SET iniciado_em = NOW() - INTERVAL '2 hours' WHERE id = $1`, antiga)
	recente := e.Sessao(c.aluno, c.treino, e.Dias(0), "EM_ANDAMENTO", nil)

	got, err := e.repos.Sessoes.FindEmAndamentoHoje(e.Ctx, c.aluno, c.treino)
	if err != nil || got.ID != recente {
		t.Errorf("got %v err=%v, want %s", got, err, recente)
	}
}

func TestSessao_UpdateStatus(t *testing.T) {
	e := novoEnv(t)
	c := e.cenario()
	fim := time.Now().UTC().Truncate(time.Microsecond)

	t.Run("conclui e grava concluido_em", func(t *testing.T) {
		s := e.novaSessao(c, e.Dias(0))
		transicionou, err := e.repos.Sessoes.UpdateStatus(e.Ctx, s.ID, domain.StatusConcluido, &fim)
		if err != nil || !transicionou {
			t.Fatalf("transicionou=%v err=%v", transicionou, err)
		}
		got, _ := e.repos.Sessoes.FindByID(e.Ctx, s.ID)
		if got.Status != domain.StatusConcluido || got.ConcluidoEm == nil || !got.ConcluidoEm.Equal(fim) {
			t.Errorf("estado final: %+v", got)
		}
	})

	t.Run("repetir a conclusao e idempotente: transicionou=false sem erro e sem alterar concluido_em", func(t *testing.T) {
		s := e.novaSessao(c, e.Dias(0))
		_, _ = e.repos.Sessoes.UpdateStatus(e.Ctx, s.ID, domain.StatusConcluido, &fim)

		depois := fim.Add(time.Hour)
		transicionou, err := e.repos.Sessoes.UpdateStatus(e.Ctx, s.ID, domain.StatusConcluido, &depois)

		if err != nil || transicionou {
			t.Fatalf("transicionou=%v err=%v, want false,nil", transicionou, err)
		}
		got, _ := e.repos.Sessoes.FindByID(e.Ctx, s.ID)
		if got.ConcluidoEm == nil || !got.ConcluidoEm.Equal(fim) {
			t.Errorf("concluido_em foi sobrescrito: %v", got.ConcluidoEm)
		}
	})

	t.Run("sessao abandonada nao pode ser concluida", func(t *testing.T) {
		s := e.novaSessao(c, e.Dias(0))
		if _, err := e.repos.Sessoes.UpdateStatus(e.Ctx, s.ID, domain.StatusAbandonado, nil); err != nil {
			t.Fatal(err)
		}
		_, err := e.repos.Sessoes.UpdateStatus(e.Ctx, s.ID, domain.StatusConcluido, &fim)
		if !errors.Is(err, domain.ErrSessaoJaConcluida) {
			t.Errorf("got %v, want ErrSessaoJaConcluida", err)
		}
	})

	t.Run("concluidoEm nil nao altera o campo", func(t *testing.T) {
		s := e.novaSessao(c, e.Dias(0))
		if _, err := e.repos.Sessoes.UpdateStatus(e.Ctx, s.ID, domain.StatusAbandonado, nil); err != nil {
			t.Fatal(err)
		}
		got, _ := e.repos.Sessoes.FindByID(e.Ctx, s.ID)
		if got.ConcluidoEm != nil {
			t.Errorf("concluido_em deveria continuar nulo, got %v", got.ConcluidoEm)
		}
	})

	t.Run("sessao inexistente", func(t *testing.T) {
		_, err := e.repos.Sessoes.UpdateStatus(e.Ctx, uuid.New(), domain.StatusConcluido, &fim)
		if !errors.Is(err, domain.ErrSessaoNotFound) {
			t.Errorf("got %v, want ErrSessaoNotFound", err)
		}
	})

	t.Run("conclusoes concorrentes: exatamente uma transiciona", func(t *testing.T) {
		s := e.novaSessao(c, e.Dias(0))
		const n = 12
		var venceram, erros atomic.Int32
		var wg sync.WaitGroup
		start := make(chan struct{})
		for i := 0; i < n; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				<-start
				ok, err := e.repos.Sessoes.UpdateStatus(context.Background(), s.ID, domain.StatusConcluido, &fim)
				if err != nil {
					erros.Add(1)
				}
				if ok {
					venceram.Add(1)
				}
			}()
		}
		close(start)
		wg.Wait()

		if erros.Load() != 0 {
			t.Errorf("%d chamadas falharam; a perdedora da corrida deve ser idempotente", erros.Load())
		}
		if venceram.Load() != 1 {
			t.Errorf("%d chamadas transicionaram, want exatamente 1 (efeitos colaterais duplicariam)", venceram.Load())
		}
	})
}

func TestSessao_ListByAluno(t *testing.T) {
	e := novoEnv(t)
	c := e.cenario()
	tB := e.Treino(c.ficha, "B", 1)
	e.Exec(`UPDATE treino SET nome = 'Costas' WHERE id = $1`, tB)
	item2 := e.Item(c.treino, e.Exercicio("Crucifixo", nil), 1, 3)
	outro := e.Aluno(c.personal)

	hoje := e.Sessao(c.aluno, c.treino, e.Dias(0), "EM_ANDAMENTO", nil)
	ontem := e.Sessao(c.aluno, tB, e.Dias(-1), "CONCLUIDO", nil)
	antes := e.Sessao(c.aluno, c.treino, e.Dias(-5), "CONCLUIDO", nil)
	e.Sessao(outro, c.treino, e.Dias(0), "EM_ANDAMENTO", nil)

	// 3 series registradas em 'hoje': 2 concluidas, 1 nao.
	for i, concl := range []bool{true, true, false} {
		e.Exec(`INSERT INTO registro_serie (id, sessao_id, item_treino_id, numero_serie, concluida)
		        VALUES ($1, $2, $3, $4, $5)`, uuid.New(), hoje, c.item, i+1, concl)
	}
	e.Exec(`INSERT INTO registro_serie (id, sessao_id, item_treino_id, numero_serie, concluida)
	        VALUES ($1, $2, $3, 1, TRUE)`, uuid.New(), hoje, item2)

	lista, total, err := e.repos.Sessoes.ListByAluno(e.Ctx, c.aluno, 1, 10)
	if err != nil {
		t.Fatal(err)
	}
	if total != 3 || len(lista) != 3 {
		t.Fatalf("total=%d len=%d, want 3/3 (sessao de outro aluno nao entra)", total, len(lista))
	}
	if lista[0].ID != hoje || lista[1].ID != ontem || lista[2].ID != antes {
		t.Errorf("ordem deveria ser data_execucao DESC")
	}
	if lista[0].TotalSeries != 4 || lista[0].SeriesConcluidas != 3 || lista[0].TreinoLetra != "A" {
		t.Errorf("resumo de hoje: %+v", lista[0])
	}
	if lista[1].TotalSeries != 0 || lista[1].SeriesConcluidas != 0 || lista[1].TreinoLetra != "B" || lista[1].TreinoNome != "Costas" {
		t.Errorf("sessao sem registros deveria ter contadores 0 e nome do treino: %+v", lista[1])
	}

	t.Run("paginacao", func(t *testing.T) {
		p2, tot, _ := e.repos.Sessoes.ListByAluno(e.Ctx, c.aluno, 2, 2)
		if tot != 3 || len(p2) != 1 || p2[0].ID != antes {
			t.Errorf("pagina 2: tot=%d len=%d", tot, len(p2))
		}
	})
	t.Run("page/perPage invalidos usam os defaults", func(t *testing.T) {
		l, tot, err := e.repos.Sessoes.ListByAluno(e.Ctx, c.aluno, 0, 0)
		if err != nil || tot != 3 || len(l) != 3 {
			t.Errorf("err=%v tot=%d len=%d", err, tot, len(l))
		}
	})
	t.Run("aluno sem sessoes", func(t *testing.T) {
		l, tot, err := e.repos.Sessoes.ListByAluno(e.Ctx, e.Aluno(c.personal), 1, 10)
		if err != nil || tot != 0 || l == nil || len(l) != 0 {
			t.Errorf("err=%v tot=%d l=%#v", err, tot, l)
		}
	})
}

// ── Registros de serie ─────────────────────────────────────────────────────

func ptrF(v float64) *float64 { return &v }
func ptrI(v int) *int         { return &v }

func TestRegistro_Upsert(t *testing.T) {
	e := novoEnv(t)
	c := e.cenario()
	s := e.novaSessao(c, e.Dias(0))
	agora := time.Now().UTC().Truncate(time.Microsecond)

	reg := &domain.RegistroSerie{
		ID: uuid.New(), SessaoID: s.ID, ItemTreinoID: c.item, NumeroSerie: 1,
		CargaRealizada: ptrF(40), RepeticoesRealizadas: ptrI(10), RPE: ptrI(7), Concluida: true, ExecutadoEm: &agora,
	}
	if err := e.repos.Registros.Upsert(e.Ctx, reg); err != nil {
		t.Fatalf("insert: %v", err)
	}
	idOriginal := reg.ID

	// Reenvio da mesma serie (correcao de carga, desmarcar): atualiza em vez de duplicar
	// e o ponteiro recebe o ID ORIGINAL da linha.
	reenvio := &domain.RegistroSerie{
		ID: uuid.New(), SessaoID: s.ID, ItemTreinoID: c.item, NumeroSerie: 1,
		CargaRealizada: ptrF(42.5), Concluida: false,
	}
	if err := e.repos.Registros.Upsert(e.Ctx, reenvio); err != nil {
		t.Fatalf("upsert: %v", err)
	}
	if reenvio.ID != idOriginal {
		t.Errorf("Upsert deveria devolver o ID original %s, got %s", idOriginal, reenvio.ID)
	}

	lista, _ := e.repos.Registros.ListBySessao(e.Ctx, s.ID)
	if len(lista) != 1 {
		t.Fatalf("deveria continuar com 1 registro, got %d", len(lista))
	}
	g := lista[0]
	if *g.CargaRealizada != 42.5 || g.RepeticoesRealizadas != nil || g.RPE != nil || g.Concluida || g.ExecutadoEm != nil {
		t.Errorf("o upsert deveria sobrescrever TODOS os campos (inclusive limpar os opcionais): %+v", g)
	}
}

func TestRegistro_Restricoes(t *testing.T) {
	e := novoEnv(t)
	c := e.cenario()
	s := e.novaSessao(c, e.Dias(0))

	novo := func(serie int, rpe *int) *domain.RegistroSerie {
		return &domain.RegistroSerie{ID: uuid.New(), SessaoID: s.ID, ItemTreinoID: c.item, NumeroSerie: serie, RPE: rpe}
	}

	for _, rpe := range []int{1, 10} {
		if err := e.repos.Registros.Upsert(e.Ctx, novo(rpe, ptrI(rpe))); err != nil {
			t.Errorf("rpe %d (limite valido) deveria ser aceito: %v", rpe, err)
		}
	}
	for _, rpe := range []int{0, 11, -1} {
		if err := e.repos.Registros.Upsert(e.Ctx, novo(20+rpe+1, ptrI(rpe))); err == nil {
			t.Errorf("rpe %d fora de 1-10 deveria violar o CHECK", rpe)
		}
	}

	semItem := novo(1, nil)
	semItem.ItemTreinoID = uuid.New()
	if err := e.repos.Registros.Upsert(e.Ctx, semItem); err == nil {
		t.Error("item_treino inexistente deveria violar a FK")
	}
	semSessao := novo(1, nil)
	semSessao.SessaoID = uuid.New()
	if err := e.repos.Registros.Upsert(e.Ctx, semSessao); err == nil {
		t.Error("sessao inexistente deveria violar a FK")
	}
}

func TestRegistro_ListECount(t *testing.T) {
	e := novoEnv(t)
	c := e.cenario()
	item2 := e.Item(c.treino, e.Exercicio("Outro", nil), 1, 3)
	s := e.novaSessao(c, e.Dias(0))
	outra := e.novaSessao(c, e.Dias(-1))

	add := func(sessao, item uuid.UUID, serie int, concl bool) {
		r := &domain.RegistroSerie{ID: uuid.New(), SessaoID: sessao, ItemTreinoID: item, NumeroSerie: serie, Concluida: concl}
		if err := e.repos.Registros.Upsert(e.Ctx, r); err != nil {
			t.Fatal(err)
		}
	}
	add(s.ID, c.item, 2, true)
	add(s.ID, c.item, 1, false)
	add(s.ID, item2, 1, true)
	add(outra.ID, c.item, 1, true)

	lista, err := e.repos.Registros.ListBySessao(e.Ctx, s.ID)
	if err != nil || len(lista) != 3 {
		t.Fatalf("len=%d err=%v (registros de outra sessao nao entram)", len(lista), err)
	}
	// Ordenado por item_treino_id, numero_serie: dentro do mesmo item, serie 1 antes da 2.
	for i := 1; i < len(lista); i++ {
		a, b := lista[i-1], lista[i]
		if a.ItemTreinoID.String() > b.ItemTreinoID.String() ||
			(a.ItemTreinoID == b.ItemTreinoID && a.NumeroSerie > b.NumeroSerie) {
			t.Errorf("ordem invalida entre %v e %v", a, b)
		}
	}

	concl, total, err := e.repos.Registros.CountBySessao(e.Ctx, s.ID)
	if err != nil || concl != 2 || total != 3 {
		t.Errorf("concl=%d total=%d err=%v, want 2/3", concl, total, err)
	}
	concl, total, _ = e.repos.Registros.CountBySessao(e.Ctx, uuid.New())
	if concl != 0 || total != 0 {
		t.Errorf("sessao sem registros: %d/%d", concl, total)
	}

	vazia, err := e.repos.Registros.ListBySessao(e.Ctx, uuid.New())
	if err != nil || vazia == nil || len(vazia) != 0 {
		t.Errorf("sessao sem registros: %#v err=%v", vazia, err)
	}
}

func TestRegistro_RemoverSessaoRemoveRegistrosEmCascata(t *testing.T) {
	e := novoEnv(t)
	c := e.cenario()
	s := e.novaSessao(c, e.Dias(0))
	if err := e.repos.Registros.Upsert(e.Ctx, &domain.RegistroSerie{ID: uuid.New(), SessaoID: s.ID, ItemTreinoID: c.item, NumeroSerie: 1}); err != nil {
		t.Fatal(err)
	}

	e.Exec(`DELETE FROM sessao_treino WHERE id = $1`, s.ID)

	if _, total, _ := e.repos.Registros.CountBySessao(e.Ctx, s.ID); total != 0 {
		t.Errorf("registros deveriam ter sido removidos em cascata, restaram %d", total)
	}
}

// ── Lookups cross-context ──────────────────────────────────────────────────

func TestTreinoLookup_GetTreinoComItens(t *testing.T) {
	e := novoEnv(t)
	p := e.Personal()
	ficha := e.FichaVigente(p, e.Aluno(p))
	tr := e.Treino(ficha, "C", 0)
	e.Exec(`UPDATE treino SET nome = 'Pernas' WHERE id = $1`, tr)
	ex := e.Exercicio("Agachamento", nil)
	segundo := e.Item(tr, ex, 1, 5)
	primeiro := e.Item(tr, ex, 0, 4)

	letra, nome, itens, err := e.repos.TreinoLookup.GetTreinoComItens(e.Ctx, tr)
	if err != nil {
		t.Fatal(err)
	}
	if letra != "C" || nome != "Pernas" || len(itens) != 2 ||
		itens[0].ID != primeiro || itens[0].Series != 4 || itens[1].ID != segundo || itens[1].Series != 5 {
		t.Errorf("letra=%q nome=%q itens=%+v", letra, nome, itens)
	}

	vazio := e.Treino(ficha, "D", 1)
	_, _, itens, err = e.repos.TreinoLookup.GetTreinoComItens(e.Ctx, vazio)
	if err != nil || itens == nil || len(itens) != 0 {
		t.Errorf("treino sem itens: %#v err=%v", itens, err)
	}

	if _, _, _, err := e.repos.TreinoLookup.GetTreinoComItens(e.Ctx, uuid.New()); !errors.Is(err, domain.ErrTreinoInvalido) {
		t.Errorf("treino inexistente: got %v, want ErrTreinoInvalido", err)
	}
}

func TestTreinoLookup_ValidarTreinoDoAluno(t *testing.T) {
	e := novoEnv(t)
	p := e.Personal()
	a, outro := e.Aluno(p), e.Aluno(p)

	vigente := e.Treino(e.FichaVigente(p, a), "A", 0)
	fimOntem := e.Dias(-1)
	expirado := e.Treino(e.Ficha(p, e.Aluno(p), e.Dias(-30), &fimOntem, true), "A", 0)
	futuro := e.Treino(e.Ficha(p, e.Aluno(p), e.Dias(1), nil, true), "A", 0)
	inativo := e.Treino(e.Ficha(p, e.Aluno(p), e.Dias(-5), nil, false), "A", 0)
	fimHoje := e.Dias(0)
	terminaHoje := e.Treino(e.Ficha(p, e.Aluno(p), e.Dias(-5), &fimHoje, true), "A", 0)

	// Os alunos das fichas "expirado/futuro/inativo/terminaHoje" sao diferentes de `a`;
	// buscamos o dono real de cada ficha para testar a regra de vigencia isoladamente.
	dono := func(treino uuid.UUID) uuid.UUID {
		var id uuid.UUID
		if err := e.Pool.QueryRow(e.Ctx,
			`SELECT f.aluno_id FROM treino t JOIN ficha_treino f ON f.id = t.ficha_id WHERE t.id = $1`, treino).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}

	casos := []struct {
		nome   string
		aluno  uuid.UUID
		treino uuid.UUID
		want   bool
	}{
		{"ficha ativa e vigente", a, vigente, true},
		{"vigencia_fim == hoje ainda vale", dono(terminaHoje), terminaHoje, true},
		{"treino de ficha de outro aluno", outro, vigente, false},
		{"ficha expirada", dono(expirado), expirado, false},
		{"ficha que comeca amanha", dono(futuro), futuro, false},
		{"ficha inativa", dono(inativo), inativo, false},
		{"treino inexistente", a, uuid.New(), false},
	}
	for _, c := range casos {
		got, err := e.repos.TreinoLookup.ValidarTreinoDoAluno(e.Ctx, c.aluno, c.treino)
		if err != nil || got != c.want {
			t.Errorf("%s: got %v err=%v, want %v", c.nome, got, err, c.want)
		}
	}
}

func TestAlunoLookup(t *testing.T) {
	e := novoEnv(t)
	p, outro := e.Personal(), e.Personal()
	a := e.Aluno(p)
	inativo := e.Aluno(p)
	e.Exec(`UPDATE aluno SET ativo = FALSE WHERE id = $1`, inativo)

	for _, c := range []struct {
		nome         string
		aluno, owner uuid.UUID
		want         bool
	}{
		{"do personal", a, p, true},
		{"de outro personal", a, outro, false},
		{"inativo", inativo, p, false},
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
	// Mesmo inativo, o aluno ainda resolve (usado para notificar o personal).
	if pid, _, err := e.repos.AlunoLookup.PersonalIDENome(e.Ctx, inativo); err != nil || pid != p {
		t.Errorf("aluno inativo: %v err=%v", pid, err)
	}
	if _, _, err := e.repos.AlunoLookup.PersonalIDENome(e.Ctx, uuid.New()); err == nil {
		t.Error("aluno inexistente deveria retornar erro")
	}
}
