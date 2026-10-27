//go:build integration

package handlers_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"errors"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/amfit/api/internal/financial/application"
	"github.com/amfit/api/internal/financial/handlers"
	"github.com/amfit/api/internal/financial/infrastructure"
	"github.com/amfit/api/internal/testsupport/pgtest"
	"github.com/amfit/api/pkg/auth"
	"github.com/amfit/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Pilha real do Financeiro: handlers + service + repositorios no PostgreSQL de
// teste + middleware JWT. Só o Notifier é falso (o contexto Notification é
// outro bounded context e aqui interessa SE e COMO ele é chamado).

type notificacaoPaga struct {
	aluno       uuid.UUID
	competencia string
	valor       float64
}

type fakeNotifier struct {
	mu    sync.Mutex
	pagas []notificacaoPaga
	err   error
}

func (f *fakeNotifier) NotificarMensalidadePaga(_ context.Context, aluno uuid.UUID, competencia string, valor float64) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.pagas = append(f.pagas, notificacaoPaga{aluno, competencia, valor})
	return f.err
}

func (f *fakeNotifier) NotificarMensalidadeVencendo(context.Context, uuid.UUID, int, float64) error {
	return f.err
}

type api struct {
	t        *testing.T
	app      *fiber.App
	seed     *pgtest.Seed
	svc      *application.FinancialService
	notifier *fakeNotifier
	priv     *rsa.PrivateKey
}

func novaAPI(t *testing.T) *api {
	t.Helper()
	pool := pgtest.NewDB(t)
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	repos := infrastructure.NewPostgresRepositories(pool)
	notifier := &fakeNotifier{}
	svc := application.NewFinancialService(repos.Planos, repos.Mensalidades, repos.AlunoLookup, notifier)
	h := handlers.NewFinancialHandler(svc)

	app := fiber.New()
	authMW := middleware.NewAuthMiddleware(&priv.PublicKey)
	// Mesma ordem do cmd/server/main.go: ALUNO antes de PERSONAL (`/alunos/me/*` vs `/alunos/:alunoId/*`).
	h.RegisterAlunoRoutes(app, authMW, middleware.RequireRole("ALUNO"))
	h.RegisterPersonalRoutes(app, authMW, middleware.RequireRole("PERSONAL"))

	return &api{t: t, app: app, seed: pgtest.NewSeed(t, pool), svc: svc, notifier: notifier, priv: priv}
}

func (a *api) token(sub uuid.UUID, role string, tenant uuid.UUID) string {
	tok, err := auth.SignToken(jwt.MapClaims{"sub": sub.String(), "role": role, "tenant_id": tenant.String()}, a.priv)
	if err != nil {
		a.t.Fatal(err)
	}
	return tok
}

func (a *api) do(method, path string, body any, token string) (int, []byte) {
	a.t.Helper()
	var rd io.Reader
	switch b := body.(type) {
	case nil:
	case string:
		rd = strings.NewReader(b)
	default:
		raw, err := json.Marshal(b)
		if err != nil {
			a.t.Fatal(err)
		}
		rd = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, rd)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := a.app.Test(req, 30*time.Second)
	if err != nil {
		a.t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, raw
}

func decode[T any](t *testing.T, raw []byte) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(raw, &v); err != nil {
		t.Fatalf("JSON invalido: %s (%v)", raw, err)
	}
	return v
}

// cenario: um personal com um aluno, ambos com token.
type cenario struct {
	personal, aluno uuid.UUID
	tokPersonal     string
	tokAluno        string
}

func (a *api) cenario() cenario {
	c := cenario{personal: a.seed.Personal()}
	c.aluno = a.seed.Aluno(c.personal)
	c.tokPersonal = a.token(c.personal, "PERSONAL", c.personal)
	c.tokAluno = a.token(c.aluno, "ALUNO", c.personal)
	return c
}

// plano cria o plano pela API (vigencia desde ontem, p/ valer no CURRENT_DATE do banco).
func (a *api) plano(c cenario, valor float64, dia int) application.PlanoResponse {
	a.t.Helper()
	st, raw := a.do(http.MethodPost, "/alunos/"+c.aluno.String()+"/plano", map[string]any{
		"valor_mensal": valor, "dia_vencimento": dia, "vigencia_inicio": a.seed.Dias(-1).Format("2006-01-02"),
	}, c.tokPersonal)
	if st != http.StatusCreated {
		a.t.Fatalf("criar plano: %d %s", st, raw)
	}
	return decode[application.PlanoResponse](a.t, raw)
}

// gerarMensalidade roda o job do worker e devolve a mensalidade do mes pela API do personal.
func (a *api) gerarMensalidade(c cenario) application.MensalidadeResponse {
	a.t.Helper()
	if n, err := a.svc.GerarMensalidadesDoMes(context.Background()); err != nil || n < 1 {
		a.t.Fatalf("GerarMensalidadesDoMes: n=%d err=%v", n, err)
	}
	st, raw := a.do(http.MethodGet, "/mensalidades?aluno_id="+c.aluno.String(), nil, c.tokPersonal)
	if st != http.StatusOK {
		a.t.Fatalf("listar: %d %s", st, raw)
	}
	l := decode[application.MensalidadeListResponse](a.t, raw)
	if len(l.Data) == 0 {
		a.t.Fatalf("nenhuma mensalidade gerada: %s", raw)
	}
	return l.Data[0]
}

// ── Plano ──────────────────────────────────────────────────────────────────

func TestPlano_CicloDeVida(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	base := "/alunos/" + c.aluno.String() + "/plano"

	p := a.plano(c, 199.90, 10)
	if p.Status != "ATIVO" || p.ValorMensal != 199.90 || p.DiaVencimento != 10 || p.AlunoID != c.aluno.String() {
		t.Errorf("plano criado: %+v", p)
	}

	t.Run("segundo plano ativo para o mesmo aluno: 409", func(t *testing.T) {
		st, raw := a.do(http.MethodPost, base, map[string]any{"valor_mensal": 100, "dia_vencimento": 5}, c.tokPersonal)
		if st != http.StatusConflict {
			t.Errorf("status = %d (%s)", st, raw)
		}
	})

	t.Run("personal le o plano do aluno e o aluno le o proprio", func(t *testing.T) {
		st, raw := a.do(http.MethodGet, base, nil, c.tokPersonal)
		if st != http.StatusOK || decode[application.PlanoResponse](t, raw).ID != p.ID {
			t.Errorf("personal: %d %s", st, raw)
		}
		st, raw = a.do(http.MethodGet, "/alunos/me/plano", nil, c.tokAluno)
		if st != http.StatusOK || decode[application.PlanoResponse](t, raw).ID != p.ID {
			t.Errorf("aluno: %d %s", st, raw)
		}
	})

	t.Run("atualiza valor, dia e observacao", func(t *testing.T) {
		st, raw := a.do(http.MethodPatch, "/planos/"+p.ID, map[string]any{"valor_mensal": 250.5, "dia_vencimento": 20, "observacao": "reajuste"}, c.tokPersonal)
		got := decode[application.PlanoResponse](t, raw)
		if st != http.StatusOK || got.ValorMensal != 250.5 || got.DiaVencimento != 20 || got.Observacao != "reajuste" {
			t.Errorf("%d %+v", st, got)
		}
	})

	t.Run("suspender libera criar outro plano ativo; reativar o antigo entao conflita", func(t *testing.T) {
		if st, raw := a.do(http.MethodPatch, "/planos/"+p.ID, map[string]any{"status": "SUSPENSO"}, c.tokPersonal); st != http.StatusOK {
			t.Fatalf("suspender: %d %s", st, raw)
		}
		if st, raw := a.do(http.MethodGet, "/alunos/me/plano", nil, c.tokAluno); st != http.StatusNotFound {
			t.Errorf("sem plano ATIVO o aluno recebe 404, got %d %s", st, raw)
		}
		novo := a.plano(c, 300, 15)
		if st, _ := a.do(http.MethodPatch, "/planos/"+p.ID, map[string]any{"status": "ATIVO"}, c.tokPersonal); st != http.StatusConflict {
			t.Errorf("reativar com outro ativo: %d, want 409", st)
		}
		_, raw := a.do(http.MethodGet, base, nil, c.tokPersonal)
		if decode[application.PlanoResponse](t, raw).ID != novo.ID {
			t.Error("o plano ativo deveria ser o novo")
		}
	})
}

func TestPlano_ValidacaoEIsolamento(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	outro := a.cenario() // outro personal com outro aluno
	base := "/alunos/" + c.aluno.String() + "/plano"

	for nome, body := range map[string]map[string]any{
		"valor zero":     {"valor_mensal": 0, "dia_vencimento": 10},
		"valor negativo": {"valor_mensal": -5, "dia_vencimento": 10},
		"dia 0":          {"valor_mensal": 100, "dia_vencimento": 0},
		"dia 29":         {"valor_mensal": 100, "dia_vencimento": 29},
		"data invalida":  {"valor_mensal": 100, "dia_vencimento": 10, "vigencia_inicio": "10/10/2026"},
	} {
		if st, _ := a.do(http.MethodPost, base, body, c.tokPersonal); st != http.StatusUnprocessableEntity {
			t.Errorf("%s: %d, want 422", nome, st)
		}
	}
	if st, _ := a.do(http.MethodPost, "/alunos/nao-e-uuid/plano", map[string]any{"valor_mensal": 100, "dia_vencimento": 10}, c.tokPersonal); st != http.StatusBadRequest {
		t.Errorf("alunoId malformado: %d, want 400", st)
	}
	if st, _ := a.do(http.MethodPost, base, "{nao e json", c.tokPersonal); st != http.StatusBadRequest {
		t.Errorf("JSON invalido: %d, want 400", st)
	}

	p := a.plano(c, 100, 10)
	// Outro personal nao enxerga nem altera: 404 (nao 403, para nao confirmar a existencia).
	for nome, req := range map[string]struct{ method, path string }{
		"criar plano p/ aluno alheio": {http.MethodPost, base},
		"ler plano de aluno alheio":   {http.MethodGet, base},
		"alterar plano alheio":        {http.MethodPatch, "/planos/" + p.ID},
	} {
		var body any
		if req.method != http.MethodGet {
			body = map[string]any{"valor_mensal": 1, "dia_vencimento": 1}
		}
		if st, _ := a.do(req.method, req.path, body, outro.tokPersonal); st != http.StatusNotFound {
			t.Errorf("%s: %d, want 404", nome, st)
		}
	}
	if st, _ := a.do(http.MethodPatch, "/planos/"+p.ID, map[string]any{"status": "QUALQUER"}, c.tokPersonal); st != http.StatusUnprocessableEntity {
		t.Errorf("status de plano invalido: %d, want 422", st)
	}

	t.Run("RBAC: aluno nao acessa rotas de personal e vice-versa", func(t *testing.T) {
		if st, _ := a.do(http.MethodGet, base, nil, c.tokAluno); st != http.StatusForbidden {
			t.Errorf("aluno em rota de personal: %d, want 403", st)
		}
		if st, _ := a.do(http.MethodGet, "/mensalidades", nil, c.tokAluno); st != http.StatusForbidden {
			t.Errorf("aluno listando mensalidades do personal: %d, want 403", st)
		}
		if st, _ := a.do(http.MethodGet, "/alunos/me/plano", nil, c.tokPersonal); st != http.StatusForbidden {
			t.Errorf("personal em rota de aluno: %d, want 403", st)
		}
		if st, _ := a.do(http.MethodGet, "/mensalidades", nil, ""); st != http.StatusUnauthorized {
			t.Errorf("sem token: %d, want 401", st)
		}
	})
}

// ── Mensalidades ───────────────────────────────────────────────────────────

func TestMensalidades_GeradasPeloWorkerAparecemParaPersonalEAluno(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	a.plano(c, 150, 10)

	m := a.gerarMensalidade(c) // inclui GET /mensalidades do personal: o endpoint que tinha o bug do JOIN ambiguo

	if m.Status != "PENDENTE" || m.Valor != 150 || m.AlunoID != c.aluno.String() || m.ValorPago != nil {
		t.Errorf("mensalidade gerada: %+v", m)
	}
	st, raw := a.do(http.MethodGet, "/alunos/me/mensalidades", nil, c.tokAluno)
	l := decode[application.MensalidadeListResponse](t, raw)
	if st != http.StatusOK || l.Pagination.Total != 1 || l.Data[0].ID != m.ID {
		t.Errorf("aluno: %d %s", st, raw)
	}
}

func TestMensalidades_ListagemFiltrosEIsolamento(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	outro := a.cenario()
	a.plano(c, 100, 10)
	a.plano(outro, 999, 10)
	a.gerarMensalidade(c)
	hoje := a.seed.Hoje()

	t.Run("personal so ve as dos proprios alunos", func(t *testing.T) {
		_, raw := a.do(http.MethodGet, "/mensalidades", nil, c.tokPersonal)
		l := decode[application.MensalidadeListResponse](t, raw)
		if l.Pagination.Total != 1 || l.Data[0].Valor != 100 {
			t.Errorf("%+v", l)
		}
		_, raw = a.do(http.MethodGet, "/mensalidades?aluno_id="+outro.aluno.String(), nil, c.tokPersonal)
		if l := decode[application.MensalidadeListResponse](t, raw); l.Pagination.Total != 0 {
			t.Errorf("aluno de outro personal vazou: %+v", l)
		}
	})

	t.Run("filtros por status e competencia", func(t *testing.T) {
		path := func(q string) int {
			_, raw := a.do(http.MethodGet, "/mensalidades?"+q, nil, c.tokPersonal)
			return decode[application.MensalidadeListResponse](t, raw).Pagination.Total
		}
		if n := path("status=PENDENTE"); n != 1 {
			t.Errorf("PENDENTE: %d", n)
		}
		if n := path("status=PAGA"); n != 0 {
			t.Errorf("PAGA: %d", n)
		}
		comp := "competencia_ano=" + itoa(hoje.Year()) + "&competencia_mes=" + itoa(int(hoje.Month()))
		if n := path(comp); n != 1 {
			t.Errorf("competencia atual: %d", n)
		}
		if n := path("competencia_ano=1999"); n != 0 {
			t.Errorf("competencia 1999: %d", n)
		}
	})

	t.Run("parametros invalidos: 400", func(t *testing.T) {
		for _, q := range []string{"status=QUALQUER", "competencia_mes=13", "competencia_mes=0", "competencia_ano=abc", "competencia_mes=x"} {
			if st, _ := a.do(http.MethodGet, "/mensalidades?"+q, nil, c.tokPersonal); st != http.StatusBadRequest {
				t.Errorf("%s: %d, want 400", q, st)
			}
		}
	})

	t.Run("aluno_id malformado e erro do cliente (400), nao 500", func(t *testing.T) {
		if st, raw := a.do(http.MethodGet, "/mensalidades?aluno_id=xyz", nil, c.tokPersonal); st != http.StatusBadRequest {
			t.Errorf("status = %d, want 400 (%s)", st, raw)
		}
	})

	t.Run("page/per_page invalidos caem nos defaults", func(t *testing.T) {
		_, raw := a.do(http.MethodGet, "/mensalidades?page=abc&per_page=-3", nil, c.tokPersonal)
		l := decode[application.MensalidadeListResponse](t, raw)
		if l.Pagination.Page != 1 || l.Pagination.PerPage != 20 {
			t.Errorf("%+v", l.Pagination)
		}
		_, raw = a.do(http.MethodGet, "/mensalidades?per_page=5000", nil, c.tokPersonal)
		if l := decode[application.MensalidadeListResponse](t, raw); l.Pagination.PerPage != 100 {
			t.Errorf("per_page deveria ser limitado a 100: %+v", l.Pagination)
		}
	})
}

func itoa(n int) string {
	b, _ := json.Marshal(n)
	return string(b)
}

func TestMarcarPaga(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	outro := a.cenario()
	a.plano(c, 180, 10)
	m := a.gerarMensalidade(c)
	path := "/mensalidades/" + m.ID + "/marcar-paga"

	t.Run("forma de pagamento e obrigatoria e restrita", func(t *testing.T) {
		for nome, body := range map[string]map[string]any{
			"sem forma":      {},
			"forma invalida": {"forma_pagamento": "CHEQUE"},
			"valor zero":     {"forma_pagamento": "PIX", "valor_pago": 0},
			"data invalida":  {"forma_pagamento": "PIX", "data_pagamento": "ontem"},
		} {
			if st, _ := a.do(http.MethodPatch, path, body, c.tokPersonal); st != http.StatusUnprocessableEntity {
				t.Errorf("%s: %d, want 422", nome, st)
			}
		}
	})

	t.Run("outro personal nao consegue pagar a mensalidade (404) e nada muda", func(t *testing.T) {
		if st, _ := a.do(http.MethodPatch, path, map[string]any{"forma_pagamento": "PIX"}, outro.tokPersonal); st != http.StatusNotFound {
			t.Errorf("%d, want 404", st)
		}
		if len(a.notifier.pagas) != 0 {
			t.Error("nao deveria notificar")
		}
	})

	t.Run("pagamento padrao: valor cheio, hoje, e notifica o aluno uma vez", func(t *testing.T) {
		st, raw := a.do(http.MethodPatch, path, map[string]any{"forma_pagamento": "PIX"}, c.tokPersonal)
		if st != http.StatusOK {
			t.Fatalf("%d %s", st, raw)
		}
		got := decode[application.MensalidadeResponse](t, raw)
		if got.Status != "PAGA" || got.ValorPago == nil || *got.ValorPago != 180 || got.FormaPagamento == nil ||
			*got.FormaPagamento != "PIX" || got.DataPagamento == nil {
			t.Errorf("pagamento: %+v", got)
		}
		if len(a.notifier.pagas) != 1 {
			t.Fatalf("notificacoes = %d, want 1", len(a.notifier.pagas))
		}
		n := a.notifier.pagas[0]
		hoje := a.seed.Hoje()
		want := notificacaoPaga{c.aluno, pad2(int(hoje.Month())) + "/" + itoa(hoje.Year()), 180}
		if n != want {
			t.Errorf("notificacao = %+v, want %+v", n, want)
		}
	})

	t.Run("pagar de novo: 409 e sem segunda notificacao", func(t *testing.T) {
		if st, _ := a.do(http.MethodPatch, path, map[string]any{"forma_pagamento": "PIX"}, c.tokPersonal); st != http.StatusConflict {
			t.Errorf("%d, want 409", st)
		}
		if len(a.notifier.pagas) != 1 {
			t.Errorf("notificacoes = %d, want 1", len(a.notifier.pagas))
		}
	})
}

func pad2(n int) string {
	if n < 10 {
		return "0" + itoa(n)
	}
	return itoa(n)
}

func TestMarcarPaga_ValorEDataInformados_NotificadorComFalhaNaoQuebra(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	a.plano(c, 200, 10)
	m := a.gerarMensalidade(c)
	a.notifier.err = errors.New("expo fora do ar")

	st, raw := a.do(http.MethodPatch, "/mensalidades/"+m.ID+"/marcar-paga", map[string]any{
		"forma_pagamento": "DINHEIRO", "valor_pago": 150.5, "data_pagamento": "2026-01-15", "observacao": "desconto combinado",
	}, c.tokPersonal)

	if st != http.StatusOK {
		t.Fatalf("falha de notificacao nao pode falhar o pagamento: %d %s", st, raw)
	}
	got := decode[application.MensalidadeResponse](t, raw)
	if *got.ValorPago != 150.5 || *got.DataPagamento != "2026-01-15" || *got.FormaPagamento != "DINHEIRO" || got.Observacao != "desconto combinado" {
		t.Errorf("valores informados nao foram respeitados: %+v", got)
	}
	// Persistiu (nao so na resposta).
	_, raw = a.do(http.MethodGet, "/alunos/me/mensalidades?status=PAGA", nil, c.tokAluno)
	if l := decode[application.MensalidadeListResponse](t, raw); l.Pagination.Total != 1 || *l.Data[0].ValorPago != 150.5 {
		t.Errorf("aluno nao ve o pagamento persistido: %s", raw)
	}
}

func TestAtualizarStatusMensalidade(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	outro := a.cenario()
	a.plano(c, 100, 10)
	m := a.gerarMensalidade(c)
	path := "/mensalidades/" + m.ID

	if st, _ := a.do(http.MethodPatch, path, map[string]any{"status": "PAGA"}, c.tokPersonal); st != http.StatusUnprocessableEntity {
		t.Errorf("so CANCELADA/ISENTA sao aceitos: %d, want 422", st)
	}
	if st, _ := a.do(http.MethodPatch, path, map[string]any{"status": "CANCELADA"}, outro.tokPersonal); st != http.StatusNotFound {
		t.Errorf("outro personal: %d, want 404", st)
	}

	st, raw := a.do(http.MethodPatch, path, map[string]any{"status": "ISENTA", "observacao": "bolsa"}, c.tokPersonal)
	if got := decode[application.MensalidadeResponse](t, raw); st != http.StatusOK || got.Status != "ISENTA" || got.Observacao != "bolsa" {
		t.Fatalf("isentar: %d %s", st, raw)
	}
	// Uma mensalidade isenta/cancelada nao pode ser paga.
	if st, _ := a.do(http.MethodPatch, path+"/marcar-paga", map[string]any{"forma_pagamento": "PIX"}, c.tokPersonal); st != http.StatusConflict {
		t.Errorf("pagar mensalidade isenta: %d, want 409", st)
	}
	// Dá para trocar entre CANCELADA e ISENTA.
	if st, _ := a.do(http.MethodPatch, path, map[string]any{"status": "CANCELADA"}, c.tokPersonal); st != http.StatusOK {
		t.Errorf("isenta -> cancelada: %d", st)
	}
}

func TestAtualizarStatusMensalidade_PagaNaoPodeSerCancelada(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	a.plano(c, 100, 10)
	m := a.gerarMensalidade(c)
	a.do(http.MethodPatch, "/mensalidades/"+m.ID+"/marcar-paga", map[string]any{"forma_pagamento": "PIX"}, c.tokPersonal)

	if st, _ := a.do(http.MethodPatch, "/mensalidades/"+m.ID, map[string]any{"status": "CANCELADA"}, c.tokPersonal); st != http.StatusConflict {
		t.Errorf("cancelar mensalidade paga: %d, want 409", st)
	}
	if st, _ := a.do(http.MethodPatch, "/mensalidades/nao-e-uuid", map[string]any{"status": "CANCELADA"}, c.tokPersonal); st != http.StatusBadRequest {
		t.Errorf("id malformado: %d, want 400", st)
	}
	if st, _ := a.do(http.MethodPatch, "/mensalidades/"+uuid.NewString(), map[string]any{"status": "CANCELADA"}, c.tokPersonal); st != http.StatusNotFound {
		t.Errorf("inexistente: %d, want 404", st)
	}
}

// ── Dashboard e comparativo ────────────────────────────────────────────────

func TestDashboardEComparativo_ComJobDeAtraso(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	a.plano(c, 100, 10)
	m := a.gerarMensalidade(c)

	// Vence ontem e o job de atraso roda: vira ATRASADA e entra na inadimplencia.
	a.seed.Exec(`UPDATE mensalidade SET data_vencimento = CURRENT_DATE - 1 WHERE id = $1`, m.ID)
	if n, err := a.svc.MarcarMensalidadesAtrasadas(context.Background()); err != nil || n != 1 {
		t.Fatalf("MarcarMensalidadesAtrasadas: n=%d err=%v", n, err)
	}

	st, raw := a.do(http.MethodGet, "/financeiro/dashboard", nil, c.tokPersonal)
	d := decode[application.DashboardFinanceiroResponse](t, raw)
	if st != http.StatusOK || d.MensalidadesAtrasadas.Qtd != 1 || d.MensalidadesAtrasadas.Valor != 100 ||
		d.MensalidadesPendentes.Qtd != 0 || len(d.Inadimplentes) != 1 || d.Inadimplentes[0].AlunoID != c.aluno.String() {
		t.Errorf("dashboard: %d %s", st, raw)
	}

	st, raw = a.do(http.MethodGet, "/financeiro/comparativo", nil, c.tokPersonal)
	cmp := decode[application.ComparativoResponse](t, raw)
	if st != http.StatusOK || len(cmp.Data) != 6 {
		t.Fatalf("comparativo: %d len=%d", st, len(cmp.Data))
	}
	atual := cmp.Data[5]
	if atual.TotalPrevisto != 100 || atual.ValorAtrasado != 100 || atual.ReceitaPaga != 0 || math.Abs(atual.TaxaInadimplenciaPct-100) > 1e-9 {
		t.Errorf("mes atual: %+v (taxa deveria ser 100%%)", atual)
	}
	if cmp.Data[0].TaxaInadimplenciaPct != 0 {
		t.Errorf("mes sem lancamentos deveria ter taxa 0 (sem dividir por zero): %+v", cmp.Data[0])
	}

	t.Run("parametro meses: default, valido e fora da faixa", func(t *testing.T) {
		tamanho := func(q string) int {
			_, raw := a.do(http.MethodGet, "/financeiro/comparativo"+q, nil, c.tokPersonal)
			return len(decode[application.ComparativoResponse](t, raw).Data)
		}
		for q, want := range map[string]int{"?meses=3": 3, "?meses=24": 24, "?meses=0": 6, "?meses=-2": 6, "?meses=abc": 6, "?meses=25": 6} {
			if got := tamanho(q); got != want {
				t.Errorf("%s => %d linhas, want %d", q, got, want)
			}
		}
	})
}

func TestDashboard_PersonalSemDadosEIsolamento(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	outro := a.cenario()
	a.plano(outro, 500, 10)
	a.gerarMensalidade(outro)

	st, raw := a.do(http.MethodGet, "/financeiro/dashboard", nil, c.tokPersonal)
	d := decode[application.DashboardFinanceiroResponse](t, raw)
	if st != http.StatusOK || d.MensalidadesPendentes.Qtd != 0 || d.ReceitaMesAtual != 0 || d.Inadimplentes == nil || len(d.Inadimplentes) != 0 {
		t.Errorf("personal sem dados nao pode ver os do outro: %d %s", st, raw)
	}
	if !strings.Contains(string(raw), `"inadimplentes":[]`) {
		t.Errorf("inadimplentes deveria serializar como [] (nao null): %s", raw)
	}
}
