//go:build integration

package infrastructure_test

import (
	"errors"
	"testing"
	"time"

	"github.com/amfit/api/internal/progress/domain"
	"github.com/amfit/api/internal/progress/infrastructure"
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

func ptrF(v float64) *float64 { return &v }
func ptrI(v int) *int         { return &v }
func ptrS(v string) *string   { return &v }

// diaUTC devolve a data (UTC, sem hora) n dias a partir de hoje no relogio do
// Go — o mesmo que Dashboard.Resumo usa para montar as janelas de 7/30 dias.
func diaUTC(n int) time.Time {
	now := time.Now().UTC()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, n)
}

type cenario struct {
	personal, aluno, treino, item, exercicio uuid.UUID
}

func (e *env) cenario() cenario {
	c := cenario{personal: e.Personal()}
	c.aluno = e.Aluno(c.personal)
	ficha := e.FichaVigente(c.personal, c.aluno)
	c.treino = e.Treino(ficha, "A", 0)
	c.exercicio = e.Exercicio("Supino", nil)
	c.item = e.Item(c.treino, c.exercicio, 0, 4)
	return c
}

func (e *env) registro(sessao, item uuid.UUID, serie int, carga *float64, reps, rpe *int, concluida bool) {
	e.Exec(`INSERT INTO registro_serie (id, sessao_id, item_treino_id, numero_serie, carga_realizada, repeticoes_realizadas, rpe, concluida)
	        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, uuid.New(), sessao, item, serie, carga, reps, rpe, concluida)
}

// ── HistoricoCarga ─────────────────────────────────────────────────────────

func TestHistoricoCarga_FiltrosEOrdem(t *testing.T) {
	e := novoEnv(t)
	c := e.cenario()
	outroEx := e.Exercicio("Crucifixo", nil)
	itemOutroEx := e.Item(c.treino, outroEx, 1, 3)
	outroAluno := e.Aluno(c.personal)

	s1 := e.Sessao(c.aluno, c.treino, diaUTC(-10), "CONCLUIDO", nil)
	s2 := e.Sessao(c.aluno, c.treino, diaUTC(-5), "CONCLUIDO", nil)
	emAndamento := e.Sessao(c.aluno, c.treino, diaUTC(-3), "EM_ANDAMENTO", nil)
	abandonada := e.Sessao(c.aluno, c.treino, diaUTC(-2), "ABANDONADO", nil)
	sAlheia := e.Sessao(outroAluno, c.treino, diaUTC(-5), "CONCLUIDO", nil)

	// Entram: series concluidas de sessoes CONCLUIDO do aluno e do exercicio.
	e.registro(s2, c.item, 2, ptrF(60), ptrI(8), ptrI(9), true)
	e.registro(s1, c.item, 1, ptrF(50), ptrI(10), nil, true)
	e.registro(s2, c.item, 1, ptrF(55), ptrI(10), ptrI(7), true)
	// Nao entram:
	e.registro(s1, c.item, 2, ptrF(99), ptrI(1), nil, false)      // serie nao concluida
	e.registro(s1, itemOutroEx, 1, ptrF(20), ptrI(12), nil, true) // outro exercicio
	e.registro(emAndamento, c.item, 1, ptrF(70), ptrI(5), nil, true)
	e.registro(abandonada, c.item, 1, ptrF(71), ptrI(5), nil, true)
	e.registro(sAlheia, c.item, 1, ptrF(80), ptrI(5), nil, true)

	got, err := e.repos.Historico.HistoricoCarga(e.Ctx, c.aluno, c.exercicio, diaUTC(-30), diaUTC(0), 100)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 3 {
		t.Fatalf("esperados 3 pontos, got %d: %+v", len(got), got)
	}
	// Ordem: data ASC, depois numero_serie ASC.
	if got[0].SessaoID != s1 || got[0].NumeroSerie != 1 || *got[0].CargaRealizada != 50 ||
		got[1].SessaoID != s2 || got[1].NumeroSerie != 1 || *got[1].CargaRealizada != 55 ||
		got[2].SessaoID != s2 || got[2].NumeroSerie != 2 || *got[2].CargaRealizada != 60 {
		t.Errorf("ordem/valores: %+v", got)
	}
	if got[0].RPE != nil || got[1].RPE == nil || *got[1].RPE != 7 || *got[2].RPE != 9 {
		t.Errorf("rpe nulo/preenchido nao foi preservado: %+v", got)
	}
	if !got[0].DataExecucao.Equal(diaUTC(-10)) {
		t.Errorf("data_execucao = %v", got[0].DataExecucao)
	}
}

func TestHistoricoCarga_IntervaloEInclusivoNasDuasPontas(t *testing.T) {
	e := novoEnv(t)
	c := e.cenario()
	dentroIni := e.Sessao(c.aluno, c.treino, diaUTC(-10), "CONCLUIDO", nil)
	dentroFim := e.Sessao(c.aluno, c.treino, diaUTC(-1), "CONCLUIDO", nil)
	antes := e.Sessao(c.aluno, c.treino, diaUTC(-11), "CONCLUIDO", nil)
	depois := e.Sessao(c.aluno, c.treino, diaUTC(0), "CONCLUIDO", nil)
	for _, s := range []uuid.UUID{dentroIni, dentroFim, antes, depois} {
		e.registro(s, c.item, 1, ptrF(10), ptrI(10), nil, true)
	}

	got, err := e.repos.Historico.HistoricoCarga(e.Ctx, c.aluno, c.exercicio, diaUTC(-10), diaUTC(-1), 100)
	if err != nil || len(got) != 2 || got[0].SessaoID != dentroIni || got[1].SessaoID != dentroFim {
		t.Errorf("BETWEEN deveria incluir as duas pontas: %+v err=%v", got, err)
	}
}

func TestHistoricoCarga_LimiteMantemOsMaisRecentesEDevolveEmOrdemCronologica(t *testing.T) {
	e := novoEnv(t)
	c := e.cenario()
	var sessoes []uuid.UUID
	for i := 5; i >= 1; i-- { // dias -5..-1, uma serie cada
		s := e.Sessao(c.aluno, c.treino, diaUTC(-i), "CONCLUIDO", nil)
		e.registro(s, c.item, 1, ptrF(float64(100-i)), ptrI(10), nil, true)
		sessoes = append(sessoes, s)
	}

	got, err := e.repos.Historico.HistoricoCarga(e.Ctx, c.aluno, c.exercicio, diaUTC(-30), diaUTC(0), 2)
	if err != nil {
		t.Fatal(err)
	}
	// Os 2 mais recentes (dias -2 e -1), mas devolvidos do mais antigo para o mais novo.
	if len(got) != 2 || got[0].SessaoID != sessoes[3] || got[1].SessaoID != sessoes[4] {
		t.Errorf("limit 2 deveria manter os mais recentes em ordem cronologica: %+v", got)
	}
}

func TestHistoricoCarga_MesmoDiaDesempataPorIniciadoEm(t *testing.T) {
	e := novoEnv(t)
	c := e.cenario()
	// A sessao MAIS ANTIGA do dia e inserida primeiro de proposito: sem o
	// desempate por iniciado_em, a ordem fisica de insercao a favoreceria e o
	// teste passaria por acaso mesmo com a query errada.
	cedo := e.Sessao(c.aluno, c.treino, diaUTC(-1), "CONCLUIDO", nil)
	tarde := e.Sessao(c.aluno, c.treino, diaUTC(-1), "CONCLUIDO", nil)
	e.Exec(`UPDATE sessao_treino SET iniciado_em = NOW() - INTERVAL '1 hour' WHERE id = $1`, tarde)
	e.Exec(`UPDATE sessao_treino SET iniciado_em = NOW() - INTERVAL '5 hours' WHERE id = $1`, cedo)
	e.registro(tarde, c.item, 1, ptrF(70), ptrI(8), nil, true)
	e.registro(cedo, c.item, 1, ptrF(60), ptrI(10), nil, true)

	// Sem o desempate o LIMIT 1 poderia devolver a sessao errada; CalcularSugestaoProgressao
	// assume que o ULTIMO ponto e o mais recente.
	todos, _ := e.repos.Historico.HistoricoCarga(e.Ctx, c.aluno, c.exercicio, diaUTC(-5), diaUTC(0), 10)
	if len(todos) != 2 || todos[0].SessaoID != cedo || todos[1].SessaoID != tarde {
		t.Fatalf("sessoes do mesmo dia deveriam seguir iniciado_em ASC: %+v", todos)
	}
	ultimo, _ := e.repos.Historico.HistoricoCarga(e.Ctx, c.aluno, c.exercicio, diaUTC(-5), diaUTC(0), 1)
	if len(ultimo) != 1 || ultimo[0].SessaoID != tarde {
		t.Errorf("limit 1 deveria manter a sessao mais recente do dia: %+v", ultimo)
	}
}

func TestHistoricoCarga_SemDadosDevolveSliceVazio(t *testing.T) {
	e := novoEnv(t)
	c := e.cenario()

	got, err := e.repos.Historico.HistoricoCarga(e.Ctx, c.aluno, c.exercicio, diaUTC(-30), diaUTC(0), 10)
	if err != nil || got == nil || len(got) != 0 {
		t.Errorf("got %#v err=%v", got, err)
	}
}

// ── Dashboard ──────────────────────────────────────────────────────────────

func TestDashboard_Resumo(t *testing.T) {
	e := novoEnv(t)
	p, outroP := e.Personal(), e.Personal()

	// Tres alunos ativos + um inativo + um aluno de outro personal.
	a1, a2, a3 := e.Aluno(p), e.Aluno(p), e.Aluno(p)
	inativo := e.Aluno(p)
	e.Exec(`UPDATE aluno SET ativo = FALSE WHERE id = $1`, inativo)
	alheio := e.Aluno(outroP)

	trein := func(aluno, personal uuid.UUID) uuid.UUID {
		return e.Treino(e.FichaVigente(personal, aluno), "A", 0)
	}
	t1, t2, t3, tIn, tAl := trein(a1, p), trein(a2, p), trein(a3, p), trein(inativo, p), trein(alheio, outroP)

	// a1: concluida ha 3 dias (conta em 7d e 30d) + concluida ha 20 dias (so 30d).
	e.Sessao(a1, t1, diaUTC(-3), "CONCLUIDO", nil)
	e.Sessao(a1, t1, diaUTC(-20), "CONCLUIDO", nil)
	// a2: so ha 15 dias (30d) => conta como "sem sessao nos ultimos 7 dias".
	e.Sessao(a2, t2, diaUTC(-15), "CONCLUIDO", nil)
	// a3: sessoes que nao contam (nao concluida) e muito antiga.
	e.Sessao(a3, t3, diaUTC(-1), "EM_ANDAMENTO", nil)
	e.Sessao(a3, t3, diaUTC(-60), "CONCLUIDO", nil)
	// Aluno inativo e aluno de outro personal nunca entram.
	e.Sessao(inativo, tIn, diaUTC(-1), "CONCLUIDO", nil)
	e.Sessao(alheio, tAl, diaUTC(-1), "CONCLUIDO", nil)

	got, err := e.repos.Dashboard.Resumo(e.Ctx, p)
	if err != nil {
		t.Fatal(err)
	}
	want := domain.DashboardResumo{
		PersonalID: p, AlunosAtivos: 3, FichasAtivas: 4,
		SessoesUltimos7Dias: 1, SessoesUltimos30Dias: 3, AlunosSemSessao7Dias: 2,
	}
	if got != want {
		t.Errorf("got  %+v\nwant %+v", got, want)
	}
}

func TestDashboard_Resumo_JanelasSaoInclusivas(t *testing.T) {
	e := novoEnv(t)
	c := e.cenario()
	e.Sessao(c.aluno, c.treino, diaUTC(-7), "CONCLUIDO", nil)  // exatamente 7 dias: conta em 7d
	e.Sessao(c.aluno, c.treino, diaUTC(-8), "CONCLUIDO", nil)  // 8 dias: so 30d
	e.Sessao(c.aluno, c.treino, diaUTC(-30), "CONCLUIDO", nil) // exatamente 30 dias: conta em 30d
	e.Sessao(c.aluno, c.treino, diaUTC(-31), "CONCLUIDO", nil) // fora

	got, err := e.repos.Dashboard.Resumo(e.Ctx, c.personal)
	if err != nil {
		t.Fatal(err)
	}
	if got.SessoesUltimos7Dias != 1 || got.SessoesUltimos30Dias != 3 || got.AlunosSemSessao7Dias != 0 {
		t.Errorf("%+v", got)
	}
}

func TestDashboard_Resumo_PersonalSemDados(t *testing.T) {
	e := novoEnv(t)
	p := e.Personal()

	got, err := e.repos.Dashboard.Resumo(e.Ctx, p)
	if err != nil {
		t.Fatal(err)
	}
	if got != (domain.DashboardResumo{PersonalID: p}) {
		t.Errorf("deveria vir tudo zerado: %+v", got)
	}
}

// ── Access (visibilidade cross-context) ────────────────────────────────────

func TestAccess_AlunoPertenceAoPersonal(t *testing.T) {
	e := novoEnv(t)
	p, outro := e.Personal(), e.Personal()
	a := e.Aluno(p)
	inativo := e.Aluno(p)
	e.Exec(`UPDATE aluno SET ativo = FALSE WHERE id = $1`, inativo)

	if err := e.repos.Access.AlunoExisteEPertenceAoPersonal(e.Ctx, p, a); err != nil {
		t.Errorf("aluno ativo do personal: %v", err)
	}
	for nome, c := range map[string][2]uuid.UUID{
		"de outro personal": {outro, a},
		"inativo":           {p, inativo},
		"inexistente":       {p, uuid.New()},
	} {
		if err := e.repos.Access.AlunoExisteEPertenceAoPersonal(e.Ctx, c[0], c[1]); !errors.Is(err, domain.ErrAlunoNotFound) {
			t.Errorf("%s: got %v, want ErrAlunoNotFound (sem distinguir 'nao existe' de 'nao e seu')", nome, err)
		}
	}
}

func TestAccess_VisibilidadeDoExercicio(t *testing.T) {
	e := novoEnv(t)
	p, outro := e.Personal(), e.Personal()
	a := e.Aluno(p)

	global := e.Exercicio("Global", nil)
	meu := e.Exercicio("Meu", &p)
	alheio := e.Exercicio("Alheio", &outro)
	inativo := e.Exercicio("Inativo", nil)
	e.Exec(`UPDATE exercicio SET ativo = FALSE WHERE id = $1`, inativo)

	casos := []struct {
		nome       string
		exercicio  uuid.UUID
		ehPersonal bool // true: ExercicioVisivelParaPersonal(p); false: ...ParaAluno(a)
		visivel    bool
	}{
		{"personal: global", global, true, true},
		{"personal: proprio", meu, true, true},
		{"personal: de outro personal", alheio, true, false},
		{"personal: inativo", inativo, true, false},
		{"personal: inexistente", uuid.New(), true, false},
		{"aluno: global", global, false, true},
		{"aluno: do proprio personal", meu, false, true},
		{"aluno: de outro personal", alheio, false, false},
		{"aluno: inativo", inativo, false, false},
		{"aluno: inexistente", uuid.New(), false, false},
	}
	for _, c := range casos {
		var err error
		if c.ehPersonal {
			err = e.repos.Access.ExercicioVisivelParaPersonal(e.Ctx, p, c.exercicio)
		} else {
			err = e.repos.Access.ExercicioVisivelParaAluno(e.Ctx, a, c.exercicio)
		}
		if c.visivel && err != nil {
			t.Errorf("%s: deveria ser visivel, got %v", c.nome, err)
		}
		if !c.visivel && !errors.Is(err, domain.ErrExercicioNotFound) {
			t.Errorf("%s: got %v, want ErrExercicioNotFound", c.nome, err)
		}
	}

	if err := e.repos.Access.ExercicioVisivelParaAluno(e.Ctx, uuid.New(), global); !errors.Is(err, domain.ErrExercicioNotFound) {
		t.Errorf("aluno inexistente: got %v", err)
	}
}

// ── Anamnese ───────────────────────────────────────────────────────────────

func anamneseBase(aluno uuid.UUID) *domain.Anamnese {
	return &domain.Anamnese{
		AlunoID: aluno, Objetivo: "hipertrofia",
		Lesoes: ptrS("joelho direito"), PraticaOutroEsporte: true, OutroEsporte: ptrS("corrida"),
		FrequenciaSemanasAnterior: ptrI(3),
		Respostas: domain.RespostasAnamnese{
			FrequenciaSemanal: domain.RespostaAnamnese{Opcao: "3x", Pontos: 3},
			ExperienciaMeses:  domain.RespostaAnamnese{Opcao: "6-12", Pontos: 2},
			Objetivo:          domain.RespostaAnamnese{Opcao: "hipertrofia", Pontos: 3},
			Restricoes:        domain.RespostaAnamnese{Opcao: "leves", Pontos: 1},
			Disponibilidade:   domain.RespostaAnamnese{Opcao: "manha", Pontos: 2},
		},
		ScoreCalculado: 11, NivelSugerido: domain.NivelIntermediario,
	}
}

func TestAnamnese_UpsertEFind_PreservaTudoInclusiveOsJSON(t *testing.T) {
	e := novoEnv(t)
	aluno := e.Aluno(e.Personal())
	a := anamneseBase(aluno)

	if err := e.repos.Anamnese.Upsert(e.Ctx, a); err != nil {
		t.Fatal(err)
	}
	if a.ID == uuid.Nil || a.PreenchidoEm.IsZero() || a.AtualizadoEm.IsZero() {
		t.Error("Upsert deveria preencher id e timestamps via RETURNING")
	}

	got, err := e.repos.Anamnese.FindByAlunoID(e.Ctx, aluno)
	if err != nil {
		t.Fatal(err)
	}
	if got.Respostas != a.Respostas {
		t.Errorf("respostas_json: %+v, want %+v", got.Respostas, a.Respostas)
	}
	if got.Objetivo != "hipertrofia" || got.ScoreCalculado != 11 || got.NivelSugerido != domain.NivelIntermediario ||
		got.Lesoes == nil || *got.Lesoes != "joelho direito" || !got.PraticaOutroEsporte ||
		*got.OutroEsporte != "corrida" || *got.FrequenciaSemanasAnterior != 3 {
		t.Errorf("anamnese inesperada: %+v", got)
	}
	if got.DoencasPreexistentes != nil || got.Medicamentos != nil || got.ObservacoesGerais != nil {
		t.Errorf("campos opcionais ausentes deveriam voltar nulos: %+v", got)
	}
}

func TestAnamnese_Reavaliacao_MantemIDEPreenchidoEmEAtualizaOResto(t *testing.T) {
	e := novoEnv(t)
	aluno := e.Aluno(e.Personal())
	primeira := anamneseBase(aluno)
	if err := e.repos.Anamnese.Upsert(e.Ctx, primeira); err != nil {
		t.Fatal(err)
	}
	time.Sleep(10 * time.Millisecond)

	segunda := anamneseBase(aluno)
	segunda.Objetivo, segunda.ScoreCalculado, segunda.NivelSugerido = "forca", 18, domain.NivelAvancado
	segunda.Lesoes, segunda.OutroEsporte, segunda.FrequenciaSemanasAnterior = nil, nil, nil // limpa opcionais
	segunda.Respostas.Objetivo = domain.RespostaAnamnese{Opcao: "forca", Pontos: 5}
	if err := e.repos.Anamnese.Upsert(e.Ctx, segunda); err != nil {
		t.Fatal(err)
	}

	if segunda.ID != primeira.ID {
		t.Errorf("reavaliacao deve manter o ID original: %s vs %s", segunda.ID, primeira.ID)
	}
	if !segunda.PreenchidoEm.Equal(primeira.PreenchidoEm) {
		t.Errorf("preenchido_em deve ser preservado: %v vs %v", segunda.PreenchidoEm, primeira.PreenchidoEm)
	}
	if !segunda.AtualizadoEm.After(primeira.AtualizadoEm) {
		t.Errorf("atualizado_em deveria avancar: %v -> %v", primeira.AtualizadoEm, segunda.AtualizadoEm)
	}

	got, _ := e.repos.Anamnese.FindByAlunoID(e.Ctx, aluno)
	if got.Objetivo != "forca" || got.ScoreCalculado != 18 || got.NivelSugerido != domain.NivelAvancado ||
		got.Lesoes != nil || got.OutroEsporte != nil || got.FrequenciaSemanasAnterior != nil ||
		got.Respostas.Objetivo.Pontos != 5 {
		t.Errorf("reavaliacao nao substituiu os dados: %+v", got)
	}

	var linhas int
	if err := e.Pool.QueryRow(e.Ctx, `SELECT COUNT(*) FROM anamnese WHERE aluno_id = $1`, aluno).Scan(&linhas); err != nil || linhas != 1 {
		t.Errorf("deveria existir exatamente 1 anamnese por aluno, got %d (err=%v)", linhas, err)
	}
}

func TestAnamnese_Erros(t *testing.T) {
	e := novoEnv(t)
	aluno := e.Aluno(e.Personal())

	if _, err := e.repos.Anamnese.FindByAlunoID(e.Ctx, aluno); !errors.Is(err, domain.ErrAnamneseNotFound) {
		t.Errorf("sem anamnese: got %v, want ErrAnamneseNotFound", err)
	}

	orfa := anamneseBase(uuid.New())
	if err := e.repos.Anamnese.Upsert(e.Ctx, orfa); err == nil {
		t.Error("aluno inexistente deveria violar a FK")
	}

	invalida := anamneseBase(aluno)
	invalida.NivelSugerido = "EXPERT"
	if err := e.repos.Anamnese.Upsert(e.Ctx, invalida); err == nil {
		t.Error("nivel fora do enum deveria falhar")
	}
	if _, err := e.repos.Anamnese.FindByAlunoID(e.Ctx, aluno); !errors.Is(err, domain.ErrAnamneseNotFound) {
		t.Errorf("upsert invalido nao pode deixar registro: %v", err)
	}
}

func TestAnamnese_RemoverAlunoRemoveAnamneseEmCascata(t *testing.T) {
	e := novoEnv(t)
	aluno := e.Aluno(e.Personal())
	if err := e.repos.Anamnese.Upsert(e.Ctx, anamneseBase(aluno)); err != nil {
		t.Fatal(err)
	}

	e.Exec(`DELETE FROM aluno WHERE id = $1`, aluno)

	if _, err := e.repos.Anamnese.FindByAlunoID(e.Ctx, aluno); !errors.Is(err, domain.ErrAnamneseNotFound) {
		t.Errorf("anamnese deveria ter sido removida em cascata: %v", err)
	}
}
