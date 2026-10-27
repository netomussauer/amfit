//go:build integration

package infrastructure_test

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/amfit/api/internal/financial/domain"
	"github.com/amfit/api/internal/financial/infrastructure"
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

// plano insere um plano direto no banco (controle total de status e vigencia).
func (e *env) plano(aluno, personal uuid.UUID, valor float64, dia int, inicio time.Time, fim *time.Time, status string) uuid.UUID {
	id := uuid.New()
	e.Exec(`INSERT INTO plano_aluno (id, aluno_id, personal_id, valor_mensal, dia_vencimento, vigencia_inicio, vigencia_fim, status)
	        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::status_plano_aluno)`,
		id, aluno, personal, valor, dia, inicio, fim, status)
	return id
}

// planoAtivo cria um plano ATIVO vigente desde ontem.
func (e *env) planoAtivo(aluno, personal uuid.UUID, valor float64, dia int) uuid.UUID {
	return e.plano(aluno, personal, valor, dia, e.Dias(-1), nil, "ATIVO")
}

// mes devolve (ano, mes) de "hoje deslocado em n meses", sem estourar em dia 31.
func (e *env) mes(n int) (int, int) {
	h := e.Hoje()
	d := time.Date(h.Year(), h.Month()+time.Month(n), 1, 0, 0, 0, 0, time.UTC)
	return d.Year(), int(d.Month())
}

func (e *env) mens(plano, aluno uuid.UUID, ano, mes int, venc time.Time, valor float64, status string, pago *float64) uuid.UUID {
	id := uuid.New()
	e.Exec(`INSERT INTO mensalidade (id, plano_id, aluno_id, competencia_ano, competencia_mes, data_vencimento, valor, status, valor_pago)
	        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::status_mensalidade, $9)`,
		id, plano, aluno, ano, mes, venc, valor, status, pago)
	return id
}

// ── PlanoAluno ─────────────────────────────────────────────────────────────

func TestPlano_CreateEFind(t *testing.T) {
	e := novoEnv(t)
	p := e.Personal()
	a := e.Aluno(p)

	pl := &domain.PlanoAluno{
		AlunoID: a, PersonalID: p, ValorMensal: 199.9, DiaVencimento: 10,
		VigenciaInicio: e.Dias(0), Status: domain.StatusPlanoAtivo, Observacao: "desconto familia",
	}
	if err := e.repos.Planos.Create(e.Ctx, pl); err != nil {
		t.Fatal(err)
	}
	if pl.ID == uuid.Nil || pl.CriadoEm.IsZero() {
		t.Error("Create deveria preencher id/criado_em via RETURNING")
	}

	got, err := e.repos.Planos.FindByID(e.Ctx, pl.ID)
	if err != nil || got == nil {
		t.Fatalf("FindByID: %v %v", got, err)
	}
	if got.ValorMensal != 199.9 || got.DiaVencimento != 10 || got.Observacao != "desconto familia" ||
		got.VigenciaFim != nil || got.Status != domain.StatusPlanoAtivo {
		t.Errorf("plano inesperado: %+v", got)
	}

	if g, err := e.repos.Planos.FindByID(e.Ctx, uuid.New()); g != nil || err != nil {
		t.Errorf("inexistente deve ser (nil, nil), got %v %v", g, err)
	}
	ativo, err := e.repos.Planos.FindAtivoByAluno(e.Ctx, a)
	if err != nil || ativo == nil || ativo.ID != pl.ID {
		t.Errorf("FindAtivoByAluno: %v %v", ativo, err)
	}
	if g, err := e.repos.Planos.FindAtivoByAluno(e.Ctx, e.Aluno(p)); g != nil || err != nil {
		t.Errorf("aluno sem plano deve ser (nil, nil), got %v %v", g, err)
	}
}

func TestPlano_UmUnicoAtivoPorAluno(t *testing.T) {
	e := novoEnv(t)
	p := e.Personal()
	a := e.Aluno(p)
	novo := func() *domain.PlanoAluno {
		return &domain.PlanoAluno{AlunoID: a, PersonalID: p, ValorMensal: 100, DiaVencimento: 5,
			VigenciaInicio: e.Dias(0), Status: domain.StatusPlanoAtivo}
	}

	primeiro := novo()
	if err := e.repos.Planos.Create(e.Ctx, primeiro); err != nil {
		t.Fatal(err)
	}
	if err := e.repos.Planos.Create(e.Ctx, novo()); !errors.Is(err, domain.ErrPlanoJaAtivo) {
		t.Fatalf("segundo ativo: got %v, want ErrPlanoJaAtivo", err)
	}

	// Encerrado nao conta: libera criar outro ativo.
	primeiro.Status = domain.StatusPlanoEncerrado
	fim := e.Dias(0)
	primeiro.VigenciaFim = &fim
	if err := e.repos.Planos.Update(e.Ctx, primeiro); err != nil {
		t.Fatal(err)
	}
	segundo := novo()
	if err := e.repos.Planos.Create(e.Ctx, segundo); err != nil {
		t.Fatalf("apos encerrar o anterior: %v", err)
	}

	// Reativar o antigo enquanto existe outro ATIVO viola a unicidade.
	primeiro.Status, primeiro.VigenciaFim = domain.StatusPlanoAtivo, nil
	if err := e.repos.Planos.Update(e.Ctx, primeiro); !errors.Is(err, domain.ErrPlanoJaAtivo) {
		t.Errorf("reativar com outro ativo: got %v, want ErrPlanoJaAtivo", err)
	}

	// Varios encerrados/suspensos coexistem.
	extra := novo()
	extra.Status = domain.StatusPlanoSuspenso
	if err := e.repos.Planos.Create(e.Ctx, extra); err != nil {
		t.Errorf("suspenso nao deveria conflitar: %v", err)
	}
}

func TestPlano_RestricoesDeDominioNoBanco(t *testing.T) {
	e := novoEnv(t)
	p := e.Personal()
	base := func(a uuid.UUID) *domain.PlanoAluno {
		return &domain.PlanoAluno{AlunoID: a, PersonalID: p, ValorMensal: 100, DiaVencimento: 10,
			VigenciaInicio: e.Dias(0), Status: domain.StatusPlanoAtivo}
	}

	for nome, mut := range map[string]func(*domain.PlanoAluno){
		"valor zero":        func(x *domain.PlanoAluno) { x.ValorMensal = 0 },
		"valor negativo":    func(x *domain.PlanoAluno) { x.ValorMensal = -1 },
		"dia 0":             func(x *domain.PlanoAluno) { x.DiaVencimento = 0 },
		"dia 29":            func(x *domain.PlanoAluno) { x.DiaVencimento = 29 },
		"dia 31":            func(x *domain.PlanoAluno) { x.DiaVencimento = 31 },
		"aluno inexistente": func(x *domain.PlanoAluno) { x.AlunoID = uuid.New() },
	} {
		pl := base(e.Aluno(p))
		mut(pl)
		err := e.repos.Planos.Create(e.Ctx, pl)
		if err == nil || errors.Is(err, domain.ErrPlanoJaAtivo) {
			t.Errorf("%s: deveria falhar por constraint, got %v", nome, err)
		}
	}
	for _, dia := range []int{1, 28} {
		pl := base(e.Aluno(p))
		pl.DiaVencimento = dia
		if err := e.repos.Planos.Create(e.Ctx, pl); err != nil {
			t.Errorf("dia %d (limite valido): %v", dia, err)
		}
	}
}

func TestPlano_Update(t *testing.T) {
	e := novoEnv(t)
	p := e.Personal()
	a := e.Aluno(p)
	pl := &domain.PlanoAluno{AlunoID: a, PersonalID: p, ValorMensal: 100, DiaVencimento: 5,
		VigenciaInicio: e.Dias(-3), Status: domain.StatusPlanoAtivo, Observacao: "x"}
	if err := e.repos.Planos.Create(e.Ctx, pl); err != nil {
		t.Fatal(err)
	}

	fim := e.Dias(30)
	pl.ValorMensal, pl.DiaVencimento, pl.VigenciaFim, pl.Observacao = 250.5, 20, &fim, ""
	if err := e.repos.Planos.Update(e.Ctx, pl); err != nil {
		t.Fatal(err)
	}
	got, _ := e.repos.Planos.FindByID(e.Ctx, pl.ID)
	if got.ValorMensal != 250.5 || got.DiaVencimento != 20 || got.VigenciaFim == nil || !got.VigenciaFim.Equal(fim) || got.Observacao != "" {
		t.Errorf("update nao persistiu: %+v", got)
	}
	if !got.VigenciaInicio.Equal(e.Dias(-3)) {
		t.Error("Update nao deve alterar vigencia_inicio")
	}

	inexistente := &domain.PlanoAluno{ID: uuid.New(), ValorMensal: 10, DiaVencimento: 1, Status: domain.StatusPlanoAtivo}
	if err := e.repos.Planos.Update(e.Ctx, inexistente); err == nil {
		t.Error("Update de plano inexistente deveria retornar erro")
	}
}

func TestPlano_ListarAtivosParaGeracao_VigenciaEStatus(t *testing.T) {
	e := novoEnv(t)
	p := e.Personal()

	vigente := e.planoAtivo(e.Aluno(p), p, 100, 5)
	terminaHoje := e.plano(e.Aluno(p), p, 100, 5, e.Dias(-10), ptrT(e.Dias(0)), "ATIVO")
	comecaHoje := e.plano(e.Aluno(p), p, 100, 5, e.Dias(0), nil, "ATIVO")
	e.plano(e.Aluno(p), p, 100, 5, e.Dias(1), nil, "ATIVO")                // futuro
	e.plano(e.Aluno(p), p, 100, 5, e.Dias(-10), ptrT(e.Dias(-1)), "ATIVO") // expirado
	e.plano(e.Aluno(p), p, 100, 5, e.Dias(-10), nil, "SUSPENSO")
	e.plano(e.Aluno(p), p, 100, 5, e.Dias(-10), nil, "ENCERRADO")

	got, err := e.repos.Planos.ListarAtivosParaGeracao(e.Ctx)
	if err != nil {
		t.Fatal(err)
	}
	ids := map[uuid.UUID]bool{}
	for _, x := range got {
		ids[x.ID] = true
	}
	if len(got) != 3 || !ids[vigente] || !ids[terminaHoje] || !ids[comecaHoje] {
		t.Errorf("esperados 3 planos (vigente, termina hoje, comeca hoje), got %d: %v", len(got), ids)
	}
}

func ptrT(t time.Time) *time.Time { return &t }

// ── Mensalidade: CRUD e listagens ──────────────────────────────────────────

func TestMensalidade_FindByIDEUpdate(t *testing.T) {
	e := novoEnv(t)
	p := e.Personal()
	a := e.Aluno(p)
	pl := e.planoAtivo(a, p, 150, 10)
	ano, mes := e.mes(0)
	id := e.mens(pl, a, ano, mes, e.Dias(5), 150, "PENDENTE", nil)

	got, err := e.repos.Mensalidades.FindByID(e.Ctx, id)
	if err != nil || got == nil {
		t.Fatalf("FindByID: %v %v", got, err)
	}
	if got.Valor != 150 || got.Status != domain.StatusMensalidadePendente || got.ValorPago != nil ||
		got.FormaPagamento != nil || got.LembreteEnviado || got.CompetenciaAno != ano || got.CompetenciaMes != mes {
		t.Errorf("mensalidade inesperada: %+v", got)
	}
	if g, err := e.repos.Mensalidades.FindByID(e.Ctx, uuid.New()); g != nil || err != nil {
		t.Errorf("inexistente deve ser (nil, nil), got %v %v", g, err)
	}

	// Pagamento
	pix, pagoEm := domain.FormaPagamentoPix, e.Dias(0)
	got.Status, got.ValorPago, got.DataPagamento, got.FormaPagamento, got.Observacao =
		domain.StatusMensalidadePaga, ptrF(150), &pagoEm, &pix, "pago no balcao"
	antes := got.AtualizadoEm
	time.Sleep(5 * time.Millisecond)
	if err := e.repos.Mensalidades.Update(e.Ctx, got); err != nil {
		t.Fatal(err)
	}
	if !got.AtualizadoEm.After(antes) {
		t.Error("atualizado_em deveria avancar")
	}
	re, _ := e.repos.Mensalidades.FindByID(e.Ctx, id)
	if re.Status != domain.StatusMensalidadePaga || *re.ValorPago != 150 || re.FormaPagamento == nil ||
		*re.FormaPagamento != domain.FormaPagamentoPix || !re.DataPagamento.Equal(pagoEm) || re.Observacao != "pago no balcao" {
		t.Errorf("pagamento nao persistiu: %+v", re)
	}

	// Desfazer: volta a PENDENTE e limpa os campos de pagamento.
	re.Status, re.ValorPago, re.DataPagamento, re.FormaPagamento, re.Observacao =
		domain.StatusMensalidadePendente, nil, nil, nil, ""
	if err := e.repos.Mensalidades.Update(e.Ctx, re); err != nil {
		t.Fatal(err)
	}
	re, _ = e.repos.Mensalidades.FindByID(e.Ctx, id)
	if re.ValorPago != nil || re.DataPagamento != nil || re.FormaPagamento != nil || re.Observacao != "" {
		t.Errorf("campos de pagamento deveriam ser limpos: %+v", re)
	}

	if err := e.repos.Mensalidades.Update(e.Ctx, &domain.Mensalidade{ID: uuid.New(), Status: domain.StatusMensalidadePendente}); err == nil {
		t.Error("Update de mensalidade inexistente deveria retornar erro")
	}
}

func TestMensalidade_UnicaPorPlanoECompetencia(t *testing.T) {
	e := novoEnv(t)
	p := e.Personal()
	a := e.Aluno(p)
	pl := e.planoAtivo(a, p, 100, 10)
	ano, mes := e.mes(0)
	e.mens(pl, a, ano, mes, e.Dias(5), 100, "PENDENTE", nil)

	_, err := e.Pool.Exec(e.Ctx, `INSERT INTO mensalidade (id, plano_id, aluno_id, competencia_ano, competencia_mes, data_vencimento, valor)
	                              VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 100)`, uuid.New(), pl, a, ano, mes)
	if err == nil {
		t.Error("UNIQUE (plano_id, competencia) deveria impedir a segunda mensalidade")
	}
}

func TestMensalidade_Listagens(t *testing.T) {
	e := novoEnv(t)
	p, outroP := e.Personal(), e.Personal()
	a1, a2, aAlheio := e.Aluno(p), e.Aluno(p), e.Aluno(outroP)
	pl1, pl2, plAlheio := e.planoAtivo(a1, p, 100, 5), e.planoAtivo(a2, p, 200, 5), e.planoAtivo(aAlheio, outroP, 300, 5)

	anoAtual, mesAtual := e.mes(0)
	anoAnt, mesAnt := e.mes(-1)
	m1 := e.mens(pl1, a1, anoAtual, mesAtual, e.Dias(10), 100, "PENDENTE", nil)
	m2 := e.mens(pl1, a1, anoAnt, mesAnt, e.Dias(-20), 100, "PAGA", ptrF(100))
	m3 := e.mens(pl2, a2, anoAtual, mesAtual, e.Dias(5), 200, "ATRASADA", nil)
	e.mens(plAlheio, aAlheio, anoAtual, mesAtual, e.Dias(5), 300, "PENDENTE", nil)

	idsDe := func(ms []*domain.Mensalidade) []uuid.UUID {
		out := make([]uuid.UUID, len(ms))
		for i, m := range ms {
			out[i] = m.ID
		}
		return out
	}
	eq := func(a, b []uuid.UUID) bool {
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
	statusAtrasada := domain.StatusMensalidadeAtrasada

	t.Run("personal: so dos proprios alunos, vencimento DESC", func(t *testing.T) {
		got, total, err := e.repos.Mensalidades.ListByPersonal(e.Ctx, p, domain.ListarMensalidadesParams{Page: 1, PerPage: 10})
		if err != nil || total != 3 || !eq(idsDe(got), []uuid.UUID{m1, m3, m2}) {
			t.Errorf("total=%d ids=%v err=%v, want 3 [m1 m3 m2]", total, idsDe(got), err)
		}
	})
	t.Run("filtros combinaveis", func(t *testing.T) {
		got, total, _ := e.repos.Mensalidades.ListByPersonal(e.Ctx, p, domain.ListarMensalidadesParams{AlunoID: &a1, Page: 1, PerPage: 10})
		if total != 2 || !eq(idsDe(got), []uuid.UUID{m1, m2}) {
			t.Errorf("aluno: %d %v", total, idsDe(got))
		}
		got, total, _ = e.repos.Mensalidades.ListByPersonal(e.Ctx, p, domain.ListarMensalidadesParams{Status: &statusAtrasada, Page: 1, PerPage: 10})
		if total != 1 || got[0].ID != m3 {
			t.Errorf("status: %d %v", total, idsDe(got))
		}
		got, total, _ = e.repos.Mensalidades.ListByPersonal(e.Ctx, p, domain.ListarMensalidadesParams{CompetenciaAno: &anoAnt, CompetenciaMes: &mesAnt, Page: 1, PerPage: 10})
		if total != 1 || got[0].ID != m2 {
			t.Errorf("competencia: %d %v", total, idsDe(got))
		}
	})
	t.Run("paginacao informa o total geral", func(t *testing.T) {
		p2, total, _ := e.repos.Mensalidades.ListByPersonal(e.Ctx, p, domain.ListarMensalidadesParams{Page: 2, PerPage: 2})
		if total != 3 || len(p2) != 1 || p2[0].ID != m2 {
			t.Errorf("pagina 2: total=%d %v", total, idsDe(p2))
		}
	})
	t.Run("aluno: so as proprias", func(t *testing.T) {
		got, total, err := e.repos.Mensalidades.ListByAluno(e.Ctx, a1, domain.ListarMensalidadesParams{Page: 1, PerPage: 10})
		if err != nil || total != 2 || !eq(idsDe(got), []uuid.UUID{m1, m2}) {
			t.Errorf("total=%d ids=%v err=%v", total, idsDe(got), err)
		}
		pago := domain.StatusMensalidadePaga
		got, total, _ = e.repos.Mensalidades.ListByAluno(e.Ctx, a1, domain.ListarMensalidadesParams{Status: &pago, Page: 1, PerPage: 10})
		if total != 1 || got[0].ID != m2 {
			t.Errorf("status pago: %d %v", total, idsDe(got))
		}
	})
	t.Run("sem resultados devolve slice vazio", func(t *testing.T) {
		got, total, err := e.repos.Mensalidades.ListByPersonal(e.Ctx, e.Personal(), domain.ListarMensalidadesParams{Page: 1, PerPage: 10})
		if err != nil || total != 0 || got == nil || len(got) != 0 {
			t.Errorf("got %#v total=%d err=%v", got, total, err)
		}
	})
}

// ── Dashboard ──────────────────────────────────────────────────────────────

func TestDashboard(t *testing.T) {
	e := novoEnv(t)
	p, outroP := e.Personal(), e.Personal()
	aA, aB, aC, aAlheio := e.Aluno(p), e.Aluno(p), e.Aluno(p), e.Aluno(outroP)
	plA, plB, plC, plAlheio := e.planoAtivo(aA, p, 1, 5), e.planoAtivo(aB, p, 1, 5), e.planoAtivo(aC, p, 1, 5), e.planoAtivo(aAlheio, outroP, 1, 5)

	anoAtual, mesAtual := e.mes(0)
	for i, valor := range []float64{100, 150} { // 2 pendentes
		ano, mes := e.mes(i)
		e.mens(plC, aC, ano, mes, e.Dias(5), valor, "PENDENTE", nil)
	}
	// Aluno A: 2 atrasadas (300 no total). Aluno B: 1 atrasada (500) => B vem primeiro.
	a1y, a1m := e.mes(-2)
	a2y, a2m := e.mes(-3)
	e.mens(plA, aA, a1y, a1m, e.Dias(-60), 200, "ATRASADA", nil)
	e.mens(plA, aA, a2y, a2m, e.Dias(-90), 100, "ATRASADA", nil)
	b1y, b1m := e.mes(-2)
	e.mens(plB, aB, b1y, b1m, e.Dias(-60), 500, "ATRASADA", nil)
	// Receita do mes: so PAGA da competencia atual conta (valor_pago, nao valor).
	e.mens(plB, aB, anoAtual, mesAtual, e.Dias(0), 400, "PAGA", ptrF(380))
	e.mens(plA, aA, anoAtual, mesAtual, e.Dias(0), 100, "PAGA", ptrF(100))
	pAntY, pAntM := e.mes(-1)
	e.mens(plB, aB, pAntY, pAntM, e.Dias(-30), 999, "PAGA", ptrF(999)) // mes anterior: fora
	e.mens(plA, aA, pAntY, pAntM, e.Dias(-30), 777, "ISENTA", nil)     // isenta: fora de tudo
	// Dados de outro personal nunca entram.
	e.mens(plAlheio, aAlheio, anoAtual, mesAtual, e.Dias(0), 9999, "ATRASADA", nil)

	d, err := e.repos.Mensalidades.Dashboard(e.Ctx, p)
	if err != nil {
		t.Fatal(err)
	}
	if d.PendentesQtd != 2 || d.PendentesValor != 250 {
		t.Errorf("pendentes: %d / %.2f, want 2 / 250", d.PendentesQtd, d.PendentesValor)
	}
	if d.AtrasadasQtd != 3 || d.AtrasadasValor != 800 {
		t.Errorf("atrasadas: %d / %.2f, want 3 / 800", d.AtrasadasQtd, d.AtrasadasValor)
	}
	if d.ReceitaMesAtual != 480 {
		t.Errorf("receita do mes = %.2f, want 480 (380 + 100; usa valor_pago e so a competencia atual)", d.ReceitaMesAtual)
	}
	if len(d.Inadimplentes) != 2 {
		t.Fatalf("inadimplentes = %+v", d.Inadimplentes)
	}
	if d.Inadimplentes[0].AlunoID != aB || d.Inadimplentes[0].QtdAtrasadas != 1 || d.Inadimplentes[0].ValorTotalAtrasado != 500 {
		t.Errorf("1o inadimplente (maior divida): %+v", d.Inadimplentes[0])
	}
	if d.Inadimplentes[1].AlunoID != aA || d.Inadimplentes[1].QtdAtrasadas != 2 || d.Inadimplentes[1].ValorTotalAtrasado != 300 {
		t.Errorf("2o inadimplente: %+v", d.Inadimplentes[1])
	}

	vazio, err := e.repos.Mensalidades.Dashboard(e.Ctx, e.Personal())
	if err != nil || vazio.PendentesQtd != 0 || vazio.ReceitaMesAtual != 0 || vazio.Inadimplentes == nil || len(vazio.Inadimplentes) != 0 {
		t.Errorf("personal sem dados: %+v err=%v", vazio, err)
	}
}

// ── Comparativo ────────────────────────────────────────────────────────────

func TestComparativo(t *testing.T) {
	e := novoEnv(t)
	p, outroP := e.Personal(), e.Personal()
	a, aAlheio := e.Aluno(p), e.Aluno(outroP)
	// Um plano por mensalidade do mesmo mes evita colisao da UNIQUE (plano, competencia).
	novoPlano := func() uuid.UUID { return e.plano(a, p, 1, 5, e.Dias(-400), nil, "ENCERRADO") }

	anoAtual, mesAtual := e.mes(0)
	anoAnt, mesAnt := e.mes(-1)
	anoVelho, mesVelho := e.mes(-13)

	// Mes atual: PAGA 100 (pago 90), PENDENTE 50, ATRASADA 30, ISENTA 40, CANCELADA 20.
	e.mens(novoPlano(), a, anoAtual, mesAtual, e.Dias(0), 100, "PAGA", ptrF(90))
	e.mens(novoPlano(), a, anoAtual, mesAtual, e.Dias(0), 50, "PENDENTE", nil)
	e.mens(novoPlano(), a, anoAtual, mesAtual, e.Dias(0), 30, "ATRASADA", nil)
	e.mens(novoPlano(), a, anoAtual, mesAtual, e.Dias(0), 40, "ISENTA", nil)
	e.mens(novoPlano(), a, anoAtual, mesAtual, e.Dias(0), 20, "CANCELADA", nil)
	// Mes anterior.
	e.mens(novoPlano(), a, anoAnt, mesAnt, e.Dias(-30), 200, "PAGA", ptrF(200))
	// Fora da janela de 6 meses e de outro personal: nao entram.
	e.mens(novoPlano(), a, anoVelho, mesVelho, e.Dias(-400), 5000, "PAGA", ptrF(5000))
	plAlheio := e.planoAtivo(aAlheio, outroP, 1, 5)
	e.mens(plAlheio, aAlheio, anoAtual, mesAtual, e.Dias(0), 7777, "PAGA", ptrF(7777))

	got, err := e.repos.Mensalidades.Comparativo(e.Ctx, p, 6)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 6 {
		t.Fatalf("deveria ter 1 linha por mes da janela (6), got %d: %+v", len(got), got)
	}
	// Ordem cronologica, terminando no mes atual, sem buracos.
	for i, c := range got {
		ano, mes := e.mes(i - 5)
		if c.Ano != ano || c.Mes != mes {
			t.Errorf("linha %d = %d/%d, want %d/%d", i, c.Ano, c.Mes, ano, mes)
		}
	}
	atual, anterior := got[5], got[4]
	if atual.ReceitaPaga != 90 || atual.TotalPrevisto != 180 || atual.ValorAtrasado != 30 {
		t.Errorf("mes atual: %+v, want paga=90 previsto=180 (sem ISENTA/CANCELADA) atrasado=30", atual)
	}
	if anterior.ReceitaPaga != 200 || anterior.TotalPrevisto != 200 || anterior.ValorAtrasado != 0 {
		t.Errorf("mes anterior: %+v", anterior)
	}
	for i := 0; i < 4; i++ {
		if got[i].ReceitaPaga != 0 || got[i].TotalPrevisto != 0 || got[i].ValorAtrasado != 0 {
			t.Errorf("mes sem lancamentos deveria vir zerado: %+v", got[i])
		}
	}

	t.Run("janela maior inclui o mes antigo", func(t *testing.T) {
		g, _ := e.repos.Mensalidades.Comparativo(e.Ctx, p, 14)
		if len(g) != 14 || g[0].ReceitaPaga != 5000 {
			t.Errorf("len=%d primeira=%+v", len(g), g[0])
		}
	})
	t.Run("janela de 1 mes", func(t *testing.T) {
		g, _ := e.repos.Mensalidades.Comparativo(e.Ctx, p, 1)
		if len(g) != 1 || g[0].Ano != anoAtual || g[0].Mes != mesAtual {
			t.Errorf("%+v", g)
		}
	})
	t.Run("personal sem lancamentos: serie completa zerada", func(t *testing.T) {
		g, err := e.repos.Mensalidades.Comparativo(e.Ctx, e.Personal(), 3)
		if err != nil || len(g) != 3 {
			t.Fatalf("len=%d err=%v", len(g), err)
		}
		for _, c := range g {
			if c.ReceitaPaga != 0 || c.TotalPrevisto != 0 || c.ValorAtrasado != 0 {
				t.Errorf("deveria ser zero: %+v", c)
			}
		}
	})
}

// ── Rotinas do worker ──────────────────────────────────────────────────────

func TestGerarPendentes(t *testing.T) {
	e := novoEnv(t)
	p := e.Personal()
	anoAtual, mesAtual := e.mes(0)

	a1 := e.Aluno(p)
	pl1 := e.planoAtivo(a1, p, 123.45, 10)
	pl2 := e.planoAtivo(e.Aluno(p), p, 200, 1)
	// Nao geram: suspenso, encerrado, futuro, expirado.
	e.plano(e.Aluno(p), p, 100, 5, e.Dias(-10), nil, "SUSPENSO")
	e.plano(e.Aluno(p), p, 100, 5, e.Dias(-10), nil, "ENCERRADO")
	e.plano(e.Aluno(p), p, 100, 5, e.Dias(1), nil, "ATIVO")
	e.plano(e.Aluno(p), p, 100, 5, e.Dias(-10), ptrT(e.Dias(-1)), "ATIVO")

	n, err := e.repos.Mensalidades.GerarPendentes(e.Ctx)
	if err != nil || n != 2 {
		t.Fatalf("gerou %d (err=%v), want 2", n, err)
	}

	var venc time.Time
	var valor float64
	var status string
	var ano, mes int
	must(t, e.Pool.QueryRow(e.Ctx, `SELECT data_vencimento, valor::float8, status::text, competencia_ano, competencia_mes
	                               FROM mensalidade WHERE plano_id = $1`, pl1).Scan(&venc, &valor, &status, &ano, &mes))
	primeiroDia := time.Date(anoAtual, time.Month(mesAtual), 1, 0, 0, 0, 0, time.UTC)
	if !venc.Equal(primeiroDia.AddDate(0, 0, 9)) || valor != 123.45 || status != "PENDENTE" || ano != anoAtual || mes != mesAtual {
		t.Errorf("mensalidade gerada: venc=%v valor=%v status=%s %d/%d", venc, valor, status, ano, mes)
	}
	must(t, e.Pool.QueryRow(e.Ctx, `SELECT data_vencimento FROM mensalidade WHERE plano_id = $1`, pl2).Scan(&venc))
	if !venc.Equal(primeiroDia) {
		t.Errorf("dia_vencimento=1 deveria vencer no dia 1, got %v", venc)
	}

	t.Run("idempotente: segunda execucao nao gera nada", func(t *testing.T) {
		n, err := e.repos.Mensalidades.GerarPendentes(e.Ctx)
		if err != nil || n != 0 {
			t.Errorf("gerou %d (err=%v), want 0", n, err)
		}
		var total int
		must(t, e.Pool.QueryRow(e.Ctx, `SELECT COUNT(*) FROM mensalidade`).Scan(&total))
		if total != 2 {
			t.Errorf("total de mensalidades = %d, want 2", total)
		}
	})

	t.Run("novo plano entra na proxima execucao", func(t *testing.T) {
		e.planoAtivo(e.Aluno(p), p, 50, 15)
		if n, _ := e.repos.Mensalidades.GerarPendentes(e.Ctx); n != 1 {
			t.Errorf("gerou %d, want 1", n)
		}
	})
}

func TestGerarPendentes_ExecucoesConcorrentesNaoDuplicam(t *testing.T) {
	e := novoEnv(t)
	p := e.Personal()
	const planos = 15
	for i := 0; i < planos; i++ {
		e.planoAtivo(e.Aluno(p), p, 100, 10)
	}

	// Simula N replicas do worker disparando ao mesmo tempo.
	const workers = 6
	var wg sync.WaitGroup
	var mu sync.Mutex
	somaGeradas, falhas := 0, 0
	start := make(chan struct{})
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			n, err := e.repos.Mensalidades.GerarPendentes(e.Ctx)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				falhas++
				return
			}
			somaGeradas += n
		}()
	}
	close(start)
	wg.Wait()

	var linhas, distintas int
	must(t, e.Pool.QueryRow(e.Ctx, `SELECT COUNT(*), COUNT(DISTINCT plano_id) FROM mensalidade`).Scan(&linhas, &distintas))
	if linhas != distintas {
		t.Fatalf("mensalidades duplicadas: %d linhas para %d planos", linhas, distintas)
	}
	if somaGeradas != linhas {
		t.Errorf("contagem reportada (%d) difere do que foi gravado (%d)", somaGeradas, linhas)
	}
	// Uma execucao final converge: nada fica sem mensalidade.
	n, err := e.repos.Mensalidades.GerarPendentes(e.Ctx)
	if err != nil {
		t.Fatal(err)
	}
	must(t, e.Pool.QueryRow(e.Ctx, `SELECT COUNT(*) FROM mensalidade`).Scan(&linhas))
	if linhas != planos {
		t.Errorf("apos convergir: %d mensalidades para %d planos (ultima execucao gerou %d)", linhas, planos, n)
	}
	if falhas > 0 {
		t.Logf("%d de %d execucoes concorrentes falharam (violacao de UNIQUE sem ON CONFLICT) — sem duplicar dados, mas o worker de cada replica logaria erro", falhas, workers)
	}
}

func TestMarcarAtrasadas(t *testing.T) {
	e := novoEnv(t)
	p := e.Personal()
	a := e.Aluno(p)
	pl := e.planoAtivo(a, p, 100, 5)

	mes := func(n int) (int, int) { return e.mes(n) }
	y1, m1 := mes(-1)
	y2, m2 := mes(-2)
	y3, m3 := mes(-3)
	y4, m4 := mes(-4)
	y5, m5 := mes(-5)
	vencida := e.mens(pl, a, y1, m1, e.Dias(-1), 100, "PENDENTE", nil)
	venceHoje := e.mens(pl, a, y2, m2, e.Dias(0), 100, "PENDENTE", nil)
	futura := e.mens(pl, a, y3, m3, e.Dias(3), 100, "PENDENTE", nil)
	paga := e.mens(pl, a, y4, m4, e.Dias(-30), 100, "PAGA", ptrF(100))
	jaAtrasada := e.mens(pl, a, y5, m5, e.Dias(-60), 100, "ATRASADA", nil)

	n, err := e.repos.Mensalidades.MarcarAtrasadas(e.Ctx)
	if err != nil || n != 1 {
		t.Fatalf("marcou %d (err=%v), want 1", n, err)
	}
	status := func(id uuid.UUID) domain.StatusMensalidade {
		m, _ := e.repos.Mensalidades.FindByID(e.Ctx, id)
		return m.Status
	}
	want := map[uuid.UUID]domain.StatusMensalidade{
		vencida: domain.StatusMensalidadeAtrasada, venceHoje: domain.StatusMensalidadePendente,
		futura: domain.StatusMensalidadePendente, paga: domain.StatusMensalidadePaga,
		jaAtrasada: domain.StatusMensalidadeAtrasada,
	}
	for id, w := range want {
		if got := status(id); got != w {
			t.Errorf("%s: %s, want %s (vence hoje ainda nao e atraso)", id, got, w)
		}
	}
	if n, _ := e.repos.Mensalidades.MarcarAtrasadas(e.Ctx); n != 0 {
		t.Errorf("segunda execucao marcou %d, want 0", n)
	}
}

func TestLembretes(t *testing.T) {
	e := novoEnv(t)
	p := e.Personal()
	a := e.Aluno(p)
	pl := e.planoAtivo(a, p, 100, 5)
	y := func(n int) (int, int) { return e.mes(n) }

	y1, m1 := y(-1)
	y2, m2 := y(-2)
	y3, m3 := y(-3)
	y4, m4 := y(-4)
	y5, m5 := y(-5)
	y6, m6 := y(-6)
	em3dias := e.mens(pl, a, y1, m1, e.Dias(3), 100, "PENDENTE", nil)
	em1dia := e.mens(pl, a, y2, m2, e.Dias(1), 100, "PENDENTE", nil)
	jaVencida := e.mens(pl, a, y3, m3, e.Dias(-2), 100, "PENDENTE", nil)
	e.mens(pl, a, y4, m4, e.Dias(4), 100, "PENDENTE", nil)   // fora da janela
	e.mens(pl, a, y5, m5, e.Dias(1), 100, "PAGA", ptrF(100)) // nao pendente
	enviada := e.mens(pl, a, y6, m6, e.Dias(1), 100, "PENDENTE", nil)
	must(t, e.repos.Mensalidades.MarcarLembreteEnviado(e.Ctx, enviada))

	got, err := e.repos.Mensalidades.ListarParaLembrete(e.Ctx, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 3 || got[0].ID != jaVencida || got[1].ID != em1dia || got[2].ID != em3dias {
		ids := []uuid.UUID{}
		for _, m := range got {
			ids = append(ids, m.ID)
		}
		t.Fatalf("esperado [jaVencida, em1dia, em3dias] por vencimento ASC, got %v", ids)
	}

	limitado, _ := e.repos.Mensalidades.ListarParaLembrete(e.Ctx, 2)
	if len(limitado) != 2 || limitado[0].ID != jaVencida {
		t.Errorf("limit 2: %d itens", len(limitado))
	}

	must(t, e.repos.Mensalidades.MarcarLembreteEnviado(e.Ctx, jaVencida))
	depois, _ := e.repos.Mensalidades.ListarParaLembrete(e.Ctx, 10)
	if len(depois) != 2 {
		t.Errorf("apos marcar enviado deveria sobrar 2, got %d", len(depois))
	}
	if err := e.repos.Mensalidades.MarcarLembreteEnviado(e.Ctx, uuid.New()); err != nil {
		t.Errorf("marcar id inexistente nao deve falhar (UPDATE sem linhas): %v", err)
	}
}

func TestAlunoLookup_Financial(t *testing.T) {
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
}

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}
