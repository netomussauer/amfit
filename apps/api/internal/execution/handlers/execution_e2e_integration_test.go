//go:build integration

package handlers_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/amfit/api/internal/execution/application"
	"github.com/amfit/api/internal/execution/handlers"
	"github.com/amfit/api/internal/execution/infrastructure"
	"github.com/amfit/api/internal/testsupport/pgtest"
	"github.com/amfit/api/pkg/auth"
	"github.com/amfit/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Pilha real do Execution: handlers + service + repositorios no PostgreSQL de
// teste + middleware JWT. So o Notifier e falso.

type notificacaoConclusao struct {
	personal uuid.UUID
	aluno    string
}

type fakeNotifier struct {
	mu     sync.Mutex
	enviou []notificacaoConclusao
}

func (f *fakeNotifier) NotificarTreinoConcluido(_ context.Context, personal uuid.UUID, alunoNome string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.enviou = append(f.enviou, notificacaoConclusao{personal, alunoNome})
	return nil
}

func (f *fakeNotifier) total() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.enviou)
}

type api struct {
	t        *testing.T
	app      *fiber.App
	seed     *pgtest.Seed
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
	svc := application.NewExecutionService(repos.Sessoes, repos.Registros, repos.TreinoLookup, repos.AlunoLookup, notifier)
	h := handlers.NewExecutionHandler(svc)

	app := fiber.New()
	authMW := middleware.NewAuthMiddleware(&priv.PublicKey)
	// Mesma ordem do cmd/server/main.go: ALUNO antes de PERSONAL (`/alunos/me/*` vs `/alunos/:alunoId/*`).
	h.RegisterAlunoRoutes(app, authMW, middleware.RequireRole("ALUNO"))
	h.RegisterPersonalRoutes(app, authMW, middleware.RequireRole("PERSONAL"))

	return &api{t: t, app: app, seed: pgtest.NewSeed(t, pool), notifier: notifier, priv: priv}
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
		a.t.Errorf("app.Test: %v", err) // Errorf: este helper tambem roda em goroutines
		return 0, nil
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

// cenario: personal -> aluno com ficha vigente, treino A e um item de 3 series.
type cenario struct {
	personal, aluno, treino, item uuid.UUID
	tokPersonal, tokAluno         string
}

func (a *api) cenario() cenario {
	c := cenario{personal: a.seed.Personal()}
	c.aluno = a.seed.Aluno(c.personal)
	ficha := a.seed.FichaVigente(c.personal, c.aluno)
	c.treino = a.seed.Treino(ficha, "A", 0)
	c.item = a.seed.Item(c.treino, a.seed.Exercicio("Supino", nil), 0, 3)
	c.tokPersonal = a.token(c.personal, "PERSONAL", c.personal)
	c.tokAluno = a.token(c.aluno, "ALUNO", c.personal)
	return c
}

func (a *api) iniciar(c cenario) application.SessaoResponse {
	a.t.Helper()
	st, raw := a.do(http.MethodPost, "/sessoes", map[string]string{"treino_id": c.treino.String()}, c.tokAluno)
	if st != http.StatusOK {
		a.t.Fatalf("iniciar: %d %s", st, raw)
	}
	return decode[application.SessaoResponse](a.t, raw)
}

func serie(c cenario, n int, concluida bool, extra map[string]any) map[string]any {
	body := map[string]any{"item_treino_id": c.item.String(), "numero_serie": n, "concluida": concluida}
	for k, v := range extra {
		body[k] = v
	}
	return body
}

// ── Iniciar sessao ─────────────────────────────────────────────────────────

func TestIniciarSessao_CriaERetomaNoMesmoDia(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()

	s1 := a.iniciar(c)
	s2 := a.iniciar(c) // abrir a tela de novo nao multiplica sessoes

	if s1.Status != "EM_ANDAMENTO" || s1.TreinoID != c.treino.String() || len(s1.Series) != 0 {
		t.Errorf("sessao criada: %+v", s1)
	}
	if s2.ID != s1.ID {
		t.Errorf("iniciar de novo deveria retomar %s, devolveu %s", s1.ID, s2.ID)
	}
	var n int
	if err := a.seed.Pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM sessao_treino WHERE aluno_id = $1`, c.aluno).Scan(&n); err != nil || n != 1 {
		t.Errorf("sessoes no banco = %d (err=%v), want 1", n, err)
	}
}

// A janela entre "procurar a sessao em andamento" e "inserir" e pequena: um
// unico round com poucas requisicoes (e pool de conexoes ainda frio, que
// serializa as chamadas) passa por acaso mesmo com a corrida presente. Por isso
// sao varios rounds, cada um com 16 requisicoes simultaneas para um aluno novo
// — antes da correcao (lock consultivo no repositorio) quase todo round criava
// de 10 a 16 sessoes duplicadas.
func TestIniciarSessao_DuploToqueConcorrenteNaoDuplicaASessao(t *testing.T) {
	a := novaAPI(t)
	const rounds, toques = 25, 16

	for r := 0; r < rounds; r++ {
		c := a.cenario()
		ids := make([]string, toques)
		var wg sync.WaitGroup
		start := make(chan struct{})
		for i := 0; i < toques; i++ {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				<-start
				_, raw := a.do(http.MethodPost, "/sessoes", map[string]string{"treino_id": c.treino.String()}, c.tokAluno)
				var s application.SessaoResponse
				_ = json.Unmarshal(raw, &s)
				ids[i] = s.ID
			}(i)
		}
		close(start)
		wg.Wait()

		var n int
		if err := a.seed.Pool.QueryRow(context.Background(),
			`SELECT COUNT(*) FROM sessao_treino WHERE aluno_id = $1 AND status = 'EM_ANDAMENTO'`, c.aluno).Scan(&n); err != nil {
			t.Fatal(err)
		}
		if n != 1 {
			t.Fatalf("round %d: %d sessoes EM_ANDAMENTO criadas por %d toques simultaneos, want 1", r, n, toques)
		}
		for _, id := range ids {
			if id == "" || id != ids[0] {
				t.Fatalf("round %d: todos deveriam receber a mesma sessao: %v", r, ids)
			}
		}
	}
}

func TestIniciarSessao_Invalidos(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	outro := a.cenario()

	casos := []struct {
		nome string
		body any
		tok  string
		want int
	}{
		{"treino de outro aluno", map[string]string{"treino_id": outro.treino.String()}, c.tokAluno, http.StatusUnprocessableEntity},
		{"treino inexistente", map[string]string{"treino_id": uuid.NewString()}, c.tokAluno, http.StatusUnprocessableEntity},
		{"treino_id malformado", map[string]string{"treino_id": "xyz"}, c.tokAluno, http.StatusUnprocessableEntity},
		{"sem treino_id", map[string]string{}, c.tokAluno, http.StatusUnprocessableEntity},
		{"JSON invalido", "{nao e json", c.tokAluno, http.StatusBadRequest},
		{"personal nao inicia sessao", map[string]string{"treino_id": c.treino.String()}, c.tokPersonal, http.StatusForbidden},
		{"sem token", map[string]string{"treino_id": c.treino.String()}, "", http.StatusUnauthorized},
	}
	for _, k := range casos {
		if st, raw := a.do(http.MethodPost, "/sessoes", k.body, k.tok); st != k.want {
			t.Errorf("%s: %d, want %d (%s)", k.nome, st, k.want, raw)
		}
	}
}

func TestIniciarSessao_FichaForaDaVigenciaNaoPermite(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	a.seed.Exec(`UPDATE ficha_treino SET vigencia_fim = CURRENT_DATE - 1 WHERE aluno_id = $1`, c.aluno)

	if st, _ := a.do(http.MethodPost, "/sessoes", map[string]string{"treino_id": c.treino.String()}, c.tokAluno); st != http.StatusUnprocessableEntity {
		t.Errorf("ficha expirada: %d, want 422", st)
	}
}

// ── Registrar series ───────────────────────────────────────────────────────

func TestRegistrarSerie_UpsertIdempotenteECampos(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	s := a.iniciar(c)
	path := "/sessoes/" + s.ID + "/series"

	st, raw := a.do(http.MethodPatch, path, serie(c, 1, true, map[string]any{"carga_realizada": 42.5, "repeticoes_realizadas": 10, "rpe": 8}), c.tokAluno)
	if st != http.StatusOK {
		t.Fatalf("registrar: %d %s", st, raw)
	}
	r1 := decode[application.RegistroSerieResponse](t, raw)
	if !r1.Concluida || *r1.CargaRealizada != 42.5 || *r1.RepeticoesRealizadas != 10 || *r1.RPE != 8 || r1.ExecutadoEm == nil {
		t.Errorf("registro: %+v", r1)
	}

	// Corrigir a mesma serie (desmarcar e trocar a carga): atualiza, nao duplica, e mantem o id.
	st, raw = a.do(http.MethodPatch, path, serie(c, 1, false, map[string]any{"carga_realizada": 40}), c.tokAluno)
	r2 := decode[application.RegistroSerieResponse](t, raw)
	if st != http.StatusOK || r2.ID != r1.ID || r2.Concluida || *r2.CargaRealizada != 40 || r2.RepeticoesRealizadas != nil || r2.RPE != nil || r2.ExecutadoEm != nil {
		t.Errorf("correcao deveria sobrescrever tudo e limpar os opcionais: %d %+v", st, r2)
	}

	_, raw = a.do(http.MethodGet, "/sessoes/"+s.ID, nil, c.tokAluno)
	if got := decode[application.SessaoResponse](t, raw); len(got.Series) != 1 {
		t.Errorf("deveria haver 1 serie registrada, got %d", len(got.Series))
	}
}

func TestRegistrarSerie_Validacoes(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	outro := a.cenario()
	s := a.iniciar(c)
	path := "/sessoes/" + s.ID + "/series"

	t.Run("limites do numero da serie (item tem 3)", func(t *testing.T) {
		for n, want := range map[int]int{1: 200, 3: 200, 4: 422, 0: 422, 21: 422, -1: 422} {
			if st, _ := a.do(http.MethodPatch, path, serie(c, n, true, nil), c.tokAluno); st != want {
				t.Errorf("serie %d: %d, want %d", n, st, want)
			}
		}
	})

	t.Run("item que nao e do treino da sessao", func(t *testing.T) {
		body := map[string]any{"item_treino_id": outro.item.String(), "numero_serie": 1, "concluida": true}
		if st, _ := a.do(http.MethodPatch, path, body, c.tokAluno); st != http.StatusUnprocessableEntity {
			t.Errorf("item alheio: %d, want 422", st)
		}
		body["item_treino_id"] = uuid.NewString()
		if st, _ := a.do(http.MethodPatch, path, body, c.tokAluno); st != http.StatusUnprocessableEntity {
			t.Errorf("item inexistente: %d, want 422", st)
		}
	})

	t.Run("campos fora da faixa", func(t *testing.T) {
		for nome, extra := range map[string]map[string]any{
			"rpe 0":          {"rpe": 0},
			"rpe 11":         {"rpe": 11},
			"carga negativa": {"carga_realizada": -1},
			"reps 201":       {"repeticoes_realizadas": 201},
		} {
			st, _ := a.do(http.MethodPatch, path, serie(c, 1, true, extra), c.tokAluno)
			// rpe=0 e omitido pelo omitempty do tipo *int? Nao: ponteiro para 0 chega ao validator (min=1).
			if st != http.StatusUnprocessableEntity {
				t.Errorf("%s: %d, want 422", nome, st)
			}
		}
		for _, rpe := range []int{1, 10} {
			if st, _ := a.do(http.MethodPatch, path, serie(c, 1, true, map[string]any{"rpe": rpe}), c.tokAluno); st != http.StatusOK {
				t.Errorf("rpe %d (limite valido): %d", rpe, st)
			}
		}
	})

	t.Run("sessao de outro aluno: 404; id malformado: 400; corpo invalido: 400/422", func(t *testing.T) {
		if st, _ := a.do(http.MethodPatch, path, serie(c, 1, true, nil), outro.tokAluno); st != http.StatusNotFound {
			t.Errorf("sessao alheia: %d, want 404", st)
		}
		if st, _ := a.do(http.MethodPatch, "/sessoes/xyz/series", serie(c, 1, true, nil), c.tokAluno); st != http.StatusBadRequest {
			t.Errorf("id malformado: %d, want 400", st)
		}
		if st, _ := a.do(http.MethodPatch, path, "{nao e json", c.tokAluno); st != http.StatusBadRequest {
			t.Errorf("JSON invalido: %d, want 400", st)
		}
		if st, _ := a.do(http.MethodPatch, path, map[string]any{"numero_serie": 1}, c.tokAluno); st != http.StatusUnprocessableEntity {
			t.Errorf("sem item_treino_id: %d, want 422", st)
		}
	})
}

// ── Concluir ───────────────────────────────────────────────────────────────

func TestConcluirSessao_FluxoCompleto(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	s := a.iniciar(c)
	a.do(http.MethodPatch, "/sessoes/"+s.ID+"/series", serie(c, 1, true, nil), c.tokAluno)

	st, raw := a.do(http.MethodPatch, "/sessoes/"+s.ID+"/concluir", nil, c.tokAluno)
	if st != http.StatusOK {
		t.Fatalf("concluir: %d %s", st, raw)
	}
	fim := decode[application.SessaoResponse](t, raw)
	if fim.Status != "CONCLUIDO" || fim.ConcluidoEm == nil || len(fim.Series) != 1 {
		t.Errorf("sessao concluida: %+v", fim)
	}
	if a.notifier.total() != 1 || a.notifier.enviou[0].personal != c.personal || a.notifier.enviou[0].aluno != "Aluno" {
		t.Errorf("notificacao ao personal: %+v", a.notifier.enviou)
	}

	t.Run("concluir de novo e idempotente: mesmo concluido_em e sem 2a notificacao", func(t *testing.T) {
		st, raw := a.do(http.MethodPatch, "/sessoes/"+s.ID+"/concluir", nil, c.tokAluno)
		again := decode[application.SessaoResponse](t, raw)
		if st != http.StatusOK || !again.ConcluidoEm.Equal(*fim.ConcluidoEm) {
			t.Errorf("%d concluido_em %v vs %v", st, again.ConcluidoEm, fim.ConcluidoEm)
		}
		if a.notifier.total() != 1 {
			t.Errorf("notificacoes = %d, want 1", a.notifier.total())
		}
	})

	t.Run("sessao concluida nao aceita novos registros (409)", func(t *testing.T) {
		if st, _ := a.do(http.MethodPatch, "/sessoes/"+s.ID+"/series", serie(c, 2, true, nil), c.tokAluno); st != http.StatusConflict {
			t.Errorf("%d, want 409", st)
		}
	})
}

func TestConcluirSessao_ConcorrenteNotificaUmaSoVez(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	s := a.iniciar(c)

	const toques = 8
	status := make([]int, toques)
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i := 0; i < toques; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			status[i], _ = a.do(http.MethodPatch, "/sessoes/"+s.ID+"/concluir", nil, c.tokAluno)
		}(i)
	}
	close(start)
	wg.Wait()

	for i, st := range status {
		if st != http.StatusOK {
			t.Errorf("toque %d: %d, want 200", i, st)
		}
	}
	if a.notifier.total() != 1 {
		t.Errorf("o personal recebeu %d notificacoes para 1 treino concluido, want 1", a.notifier.total())
	}
}

func TestConcluirSessao_AbandonadaEOutrosCasos(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	outro := a.cenario()
	s := a.iniciar(c)

	if st, _ := a.do(http.MethodPatch, "/sessoes/"+s.ID+"/concluir", nil, outro.tokAluno); st != http.StatusNotFound {
		t.Errorf("concluir sessao alheia: %d, want 404", st)
	}
	if a.notifier.total() != 0 {
		t.Error("nao deveria notificar")
	}
	if st, _ := a.do(http.MethodPatch, "/sessoes/"+uuid.NewString()+"/concluir", nil, c.tokAluno); st != http.StatusNotFound {
		t.Errorf("sessao inexistente: %d, want 404", st)
	}

	a.seed.Exec(`UPDATE sessao_treino SET status = 'ABANDONADO' WHERE id = $1`, s.ID)
	if st, _ := a.do(http.MethodPatch, "/sessoes/"+s.ID+"/concluir", nil, c.tokAluno); st != http.StatusConflict {
		t.Errorf("concluir sessao abandonada: %d, want 409", st)
	}
	if st, _ := a.do(http.MethodPatch, "/sessoes/"+s.ID+"/series", serie(c, 1, true, nil), c.tokAluno); st != http.StatusConflict {
		t.Errorf("registrar em sessao abandonada: %d, want 409", st)
	}
}

// ── Leitura e historico ────────────────────────────────────────────────────

func TestBuscarSessao_Anonimato(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	outro := a.cenario()
	s := a.iniciar(c)

	if st, raw := a.do(http.MethodGet, "/sessoes/"+s.ID, nil, c.tokAluno); st != http.StatusOK || decode[application.SessaoResponse](t, raw).ID != s.ID {
		t.Errorf("dono: %d %s", st, raw)
	}
	stAlheia, bAlheia := a.do(http.MethodGet, "/sessoes/"+s.ID, nil, outro.tokAluno)
	stNaoExiste, bNaoExiste := a.do(http.MethodGet, "/sessoes/"+uuid.NewString(), nil, outro.tokAluno)
	if stAlheia != http.StatusNotFound || stNaoExiste != http.StatusNotFound || !bytes.Equal(bAlheia, bNaoExiste) {
		t.Errorf("sessao alheia e inexistente deveriam ser indistinguiveis:\n%d %s\n%d %s", stAlheia, bAlheia, stNaoExiste, bNaoExiste)
	}
	if st, _ := a.do(http.MethodGet, "/sessoes/xyz", nil, c.tokAluno); st != http.StatusBadRequest {
		t.Errorf("id malformado: %d, want 400", st)
	}
}

func TestHistorico_AlunoEPersonal(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	outro := a.cenario()

	s1 := a.iniciar(c)
	a.do(http.MethodPatch, "/sessoes/"+s1.ID+"/series", serie(c, 1, true, nil), c.tokAluno)
	a.do(http.MethodPatch, "/sessoes/"+s1.ID+"/series", serie(c, 2, false, nil), c.tokAluno)
	a.do(http.MethodPatch, "/sessoes/"+s1.ID+"/concluir", nil, c.tokAluno)
	// Segunda sessao, de outra data, para ter ordem.
	s2 := a.seed.Sessao(c.aluno, c.treino, a.seed.Dias(-3), "CONCLUIDO", nil)
	a.seed.Sessao(outro.aluno, outro.treino, a.seed.Dias(0), "CONCLUIDO", nil)

	t.Run("aluno ve so as suas, mais recente primeiro, com contadores", func(t *testing.T) {
		st, raw := a.do(http.MethodGet, "/alunos/me/sessoes", nil, c.tokAluno)
		l := decode[application.SessaoListResponse](t, raw)
		if st != http.StatusOK || l.Pagination.Total != 2 || len(l.Data) != 2 {
			t.Fatalf("%d %s", st, raw)
		}
		if l.Data[0].ID != s1.ID || l.Data[1].ID != s2.String() {
			t.Errorf("ordem por data desc: %v %v", l.Data[0].ID, l.Data[1].ID)
		}
		if l.Data[0].TreinoLetra != "A" || l.Data[0].TotalSeries != 2 || l.Data[0].SeriesConcluidas != 1 {
			t.Errorf("resumo: %+v", l.Data[0])
		}
	})

	t.Run("personal ve o historico do proprio aluno", func(t *testing.T) {
		st, raw := a.do(http.MethodGet, "/alunos/"+c.aluno.String()+"/sessoes", nil, c.tokPersonal)
		if l := decode[application.SessaoListResponse](t, raw); st != http.StatusOK || l.Pagination.Total != 2 {
			t.Errorf("%d %s", st, raw)
		}
	})

	t.Run("personal nao ve aluno de outro personal (404) e ids invalidos dao 400", func(t *testing.T) {
		if st, _ := a.do(http.MethodGet, "/alunos/"+outro.aluno.String()+"/sessoes", nil, c.tokPersonal); st != http.StatusNotFound {
			t.Errorf("aluno alheio: %d, want 404", st)
		}
		if st, _ := a.do(http.MethodGet, "/alunos/xyz/sessoes", nil, c.tokPersonal); st != http.StatusBadRequest {
			t.Errorf("alunoId malformado: %d, want 400", st)
		}
	})

	t.Run("RBAC: aluno nao usa a rota do personal e vice-versa", func(t *testing.T) {
		if st, _ := a.do(http.MethodGet, "/alunos/"+c.aluno.String()+"/sessoes", nil, c.tokAluno); st != http.StatusForbidden {
			t.Errorf("aluno em rota de personal: %d, want 403", st)
		}
		if st, _ := a.do(http.MethodGet, "/alunos/me/sessoes", nil, c.tokPersonal); st != http.StatusForbidden {
			t.Errorf("personal em rota de aluno: %d, want 403", st)
		}
	})

	t.Run("paginacao: invalidos caem no default e per_page tem teto de 100", func(t *testing.T) {
		_, raw := a.do(http.MethodGet, "/alunos/me/sessoes?page=abc&per_page=-1", nil, c.tokAluno)
		if l := decode[application.SessaoListResponse](t, raw); l.Pagination.Page != 1 || l.Pagination.PerPage != 20 {
			t.Errorf("%+v", l.Pagination)
		}
		_, raw = a.do(http.MethodGet, "/alunos/me/sessoes?per_page=9999", nil, c.tokAluno)
		if l := decode[application.SessaoListResponse](t, raw); l.Pagination.PerPage != 100 {
			t.Errorf("%+v", l.Pagination)
		}
		_, raw = a.do(http.MethodGet, "/alunos/me/sessoes?per_page=1&page=2", nil, c.tokAluno)
		if l := decode[application.SessaoListResponse](t, raw); len(l.Data) != 1 || l.Pagination.Total != 2 {
			t.Errorf("pagina 2: %+v", l)
		}
	})
}
