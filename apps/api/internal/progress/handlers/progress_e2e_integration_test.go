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
	"testing"
	"time"

	"github.com/amfit/api/internal/progress/application"
	"github.com/amfit/api/internal/progress/domain"
	"github.com/amfit/api/internal/progress/handlers"
	"github.com/amfit/api/internal/progress/infrastructure"
	"github.com/amfit/api/internal/testsupport/pgtest"
	traininginfra "github.com/amfit/api/internal/training/infrastructure"
	"github.com/amfit/api/pkg/auth"
	"github.com/amfit/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Pilha real do Progress: handlers + service + repositorios no PostgreSQL de
// teste + middleware JWT + o catalogo de templates do Training (via o mesmo
// adapter que o cmd/server/main.go usa). Nada e falso.

type matcherDoTraining struct {
	repos *traininginfra.PostgresRepositories
}

func (m matcherDoTraining) MelhorMatch(ctx context.Context, personalID uuid.UUID, nivel, objetivo string) (*domain.TemplateMatch, error) {
	t, err := m.repos.Templates.MelhorMatch(ctx, personalID, nivel, objetivo)
	if err != nil || t == nil {
		return nil, err
	}
	return &domain.TemplateMatch{ID: t.ID, Nome: t.Nome}, nil
}

type api struct {
	t    *testing.T
	app  *fiber.App
	seed *pgtest.Seed
	priv *rsa.PrivateKey
}

func novaAPI(t *testing.T) *api {
	t.Helper()
	pool := pgtest.NewDB(t)
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	repos := infrastructure.NewPostgresRepositories(pool)
	svc := application.NewProgressService(
		repos.Historico, repos.Dashboard, repos.Access, repos.Anamnese,
		matcherDoTraining{repos: traininginfra.NewPostgresRepositories(pool)},
	)
	h := handlers.NewProgressHandler(svc)

	app := fiber.New()
	authMW := middleware.NewAuthMiddleware(&priv.PublicKey)
	// Mesma ordem do cmd/server/main.go: ALUNO antes de PERSONAL.
	h.RegisterAlunoRoutes(app, authMW, middleware.RequireRole("ALUNO"))
	h.RegisterPersonalRoutes(app, authMW, middleware.RequireRole("PERSONAL"))

	return &api{t: t, app: app, seed: pgtest.NewSeed(t, pool), priv: priv}
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

type json2 = map[string]any

func decodeMap(t *testing.T, raw []byte) json2 {
	t.Helper()
	var m json2
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatalf("JSON invalido: %s (%v)", raw, err)
	}
	return m
}

// cenario: personal -> aluno com ficha/treino/item e um exercicio global.
type cenario struct {
	personal, aluno, treino, item, exercicio uuid.UUID
	tokPersonal, tokAluno                    string
}

func (a *api) cenario() cenario {
	c := cenario{personal: a.seed.Personal()}
	c.aluno = a.seed.Aluno(c.personal)
	ficha := a.seed.FichaVigente(c.personal, c.aluno)
	c.treino = a.seed.Treino(ficha, "A", 0)
	c.exercicio = a.seed.Exercicio("Supino", nil)
	c.item = a.seed.Item(c.treino, c.exercicio, 0, 4)
	c.tokPersonal = a.token(c.personal, "PERSONAL", c.personal)
	c.tokAluno = a.token(c.aluno, "ALUNO", c.personal)
	return c
}

// diaUTC: mesma base de datas que Progress.Dashboard/Historico usam (relogio UTC do Go).
func diaUTC(n int) time.Time {
	now := time.Now().UTC()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, n)
}

// sessaoComSerie cria uma sessao CONCLUIDA no dia e uma serie concluida nela.
func (a *api) sessaoComSerie(c cenario, dia time.Time, serie int, carga float64, reps int, rpe *int) {
	a.t.Helper()
	sessao := a.seed.Sessao(c.aluno, c.treino, dia, "CONCLUIDO", nil)
	a.seed.Exec(`INSERT INTO registro_serie (id, sessao_id, item_treino_id, numero_serie, carga_realizada, repeticoes_realizadas, rpe, concluida)
	             VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`, uuid.New(), sessao, c.item, serie, carga, reps, rpe)
}

func pontosDe(t *testing.T, raw []byte) []any {
	t.Helper()
	p, ok := decodeMap(t, raw)["pontos"].([]any)
	if !ok {
		t.Fatalf("pontos deveria ser uma lista (nunca null): %s", raw)
	}
	return p
}

// ── Historico de carga ─────────────────────────────────────────────────────

func TestHistorico_Aluno(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	a.sessaoComSerie(c, diaUTC(-10), 1, 50, 10, nil)
	a.sessaoComSerie(c, diaUTC(-3), 1, 55, 8, nil)
	base := "/alunos/me/progresso/exercicio/" + c.exercicio.String()

	t.Run("serie cronologica do proprio aluno", func(t *testing.T) {
		st, raw := a.do(http.MethodGet, base, nil, c.tokAluno)
		p := pontosDe(t, raw)
		if st != http.StatusOK || len(p) != 2 {
			t.Fatalf("%d %s", st, raw)
		}
		primeiro := p[0].(json2)
		if primeiro["carga_realizada"] != 50.0 || primeiro["data_execucao"] != diaUTC(-10).Format("2006-01-02") {
			t.Errorf("primeiro ponto: %v", primeiro)
		}
	})

	t.Run("filtros from/to/limit", func(t *testing.T) {
		from := diaUTC(-5).Format("2006-01-02")
		_, raw := a.do(http.MethodGet, base+"?from="+from, nil, c.tokAluno)
		if n := len(pontosDe(t, raw)); n != 1 {
			t.Errorf("from: %d pontos, want 1", n)
		}
		to := diaUTC(-5).Format("2006-01-02")
		_, raw = a.do(http.MethodGet, base+"?to="+to, nil, c.tokAluno)
		if n := len(pontosDe(t, raw)); n != 1 {
			t.Errorf("to: %d pontos, want 1", n)
		}
		_, raw = a.do(http.MethodGet, base+"?limit=1", nil, c.tokAluno)
		p := pontosDe(t, raw)
		if len(p) != 1 || p[0].(json2)["carga_realizada"] != 55.0 {
			t.Errorf("limit=1 deveria manter o ponto mais recente: %v", p)
		}
	})

	t.Run("parametros invalidos: 400", func(t *testing.T) {
		for _, q := range []string{"?from=ontem", "?to=2026-13-45", "?limit=0", "?limit=-3", "?limit=abc"} {
			if st, _ := a.do(http.MethodGet, base+q, nil, c.tokAluno); st != http.StatusBadRequest {
				t.Errorf("%s: %d, want 400", q, st)
			}
		}
		if st, _ := a.do(http.MethodGet, "/alunos/me/progresso/exercicio/xyz", nil, c.tokAluno); st != http.StatusBadRequest {
			t.Errorf("exercicioId malformado: %d, want 400", st)
		}
	})

	t.Run("exercicio sem historico devolve lista vazia, nao null", func(t *testing.T) {
		livre := a.seed.Exercicio("Sem historico", nil)
		st, raw := a.do(http.MethodGet, "/alunos/me/progresso/exercicio/"+livre.String(), nil, c.tokAluno)
		if st != http.StatusOK || len(pontosDe(t, raw)) != 0 {
			t.Errorf("%d %s", st, raw)
		}
	})

	t.Run("exercicio de outro personal ou inexistente: 404", func(t *testing.T) {
		outro := a.cenario()
		privado := a.seed.Exercicio("Privado do outro", &outro.personal)
		if st, _ := a.do(http.MethodGet, "/alunos/me/progresso/exercicio/"+privado.String(), nil, c.tokAluno); st != http.StatusNotFound {
			t.Errorf("exercicio de outro personal: %d, want 404", st)
		}
		if st, _ := a.do(http.MethodGet, "/alunos/me/progresso/exercicio/"+uuid.NewString(), nil, c.tokAluno); st != http.StatusNotFound {
			t.Errorf("exercicio inexistente: %d, want 404", st)
		}
	})

	t.Run("aluno nao enxerga a serie de outro aluno", func(t *testing.T) {
		outro := a.cenario()
		_, raw := a.do(http.MethodGet, "/alunos/me/progresso/exercicio/"+outro.exercicio.String(), nil, c.tokAluno)
		if n := len(pontosDe(t, raw)); n != 0 {
			t.Errorf("vazou historico alheio: %s", raw)
		}
	})
}

func TestHistorico_PersonalSobreOAluno(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	outro := a.cenario()
	a.sessaoComSerie(c, diaUTC(-2), 1, 60, 10, nil)
	path := "/alunos/" + c.aluno.String() + "/progresso/exercicio/" + c.exercicio.String()

	if st, raw := a.do(http.MethodGet, path, nil, c.tokPersonal); st != http.StatusOK || len(pontosDe(t, raw)) != 1 {
		t.Errorf("personal do aluno: %d %s", st, raw)
	}
	if st, _ := a.do(http.MethodGet, "/alunos/"+outro.aluno.String()+"/progresso/exercicio/"+c.exercicio.String(), nil, c.tokPersonal); st != http.StatusNotFound {
		t.Errorf("aluno de outro personal: %d, want 404", st)
	}
	privado := a.seed.Exercicio("Privado do outro", &outro.personal)
	if st, _ := a.do(http.MethodGet, "/alunos/"+c.aluno.String()+"/progresso/exercicio/"+privado.String(), nil, c.tokPersonal); st != http.StatusNotFound {
		t.Errorf("exercicio de outro personal: %d, want 404", st)
	}
	if st, _ := a.do(http.MethodGet, "/alunos/xyz/progresso/exercicio/"+c.exercicio.String(), nil, c.tokPersonal); st != http.StatusBadRequest {
		t.Errorf("alunoId malformado: %d, want 400", st)
	}

	// Aluno desativado some do acesso do personal (o lookup exige ativo).
	a.seed.Exec(`UPDATE aluno SET ativo = FALSE WHERE id = $1`, c.aluno)
	if st, _ := a.do(http.MethodGet, path, nil, c.tokPersonal); st != http.StatusNotFound {
		t.Errorf("aluno desativado: %d, want 404", st)
	}
}

func TestProgresso_RBAC(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	ex := c.exercicio.String()

	casos := []struct {
		nome, path, token string
		want              int
	}{
		{"aluno em rota de personal (historico)", "/alunos/" + c.aluno.String() + "/progresso/exercicio/" + ex, c.tokAluno, 403},
		{"aluno em rota de personal (dashboard)", "/dashboard", c.tokAluno, 403},
		{"aluno em rota de personal (anamnese)", "/alunos/" + c.aluno.String() + "/anamnese", c.tokAluno, 403},
		{"personal em rota de aluno", "/alunos/me/progresso/exercicio/" + ex, c.tokPersonal, 403},
		{"personal na sugestao do aluno", "/alunos/me/progresso/exercicio/" + ex + "/sugestao", c.tokPersonal, 403},
		{"sem token", "/dashboard", "", 401},
	}
	for _, k := range casos {
		if st, _ := a.do(http.MethodGet, k.path, nil, k.token); st != k.want {
			t.Errorf("%s: %d, want %d", k.nome, st, k.want)
		}
	}
}

// ── Sugestao de progressao ─────────────────────────────────────────────────

func TestSugestao(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	base := "/alunos/me/progresso/exercicio/" + c.exercicio.String() + "/sugestao"

	t.Run("sem historico: tem_sugestao=false e sem direcao", func(t *testing.T) {
		st, raw := a.do(http.MethodGet, base, nil, c.tokAluno)
		m := decodeMap(t, raw)
		if st != http.StatusOK || m["tem_sugestao"] != false || m["direcao"] != nil || m["carga_sugerida"] != nil {
			t.Errorf("%d %s", st, raw)
		}
	})

	t.Run("uma unica sessao ainda nao basta", func(t *testing.T) {
		a.sessaoComSerie(c, diaUTC(-6), 1, 50, 10, nil)
		_, raw := a.do(http.MethodGet, base, nil, c.tokAluno)
		if decodeMap(t, raw)["tem_sugestao"] != false {
			t.Errorf("%s", raw)
		}
	})

	t.Run("bateu a sessao anterior (mesma carga, mesmas reps): sugere aumentar 2,5 kg", func(t *testing.T) {
		a.sessaoComSerie(c, diaUTC(-2), 1, 50, 10, nil)
		st, raw := a.do(http.MethodGet, base, nil, c.tokAluno)
		m := decodeMap(t, raw)
		if st != http.StatusOK || m["tem_sugestao"] != true || m["direcao"] != "AUMENTAR" || m["carga_sugerida"] != 52.5 || m["ultima_carga_registrada"] != 50.0 {
			t.Errorf("%d %s", st, raw)
		}
	})

	t.Run("RPE alto freia o aumento (MANTER) mesmo tendo batido a sessao", func(t *testing.T) {
		a2 := novaAPI(t)
		c2 := a2.cenario()
		rpe := 10
		a2.sessaoComSerie(c2, diaUTC(-6), 1, 50, 10, &rpe)
		a2.sessaoComSerie(c2, diaUTC(-2), 1, 50, 10, &rpe)
		_, raw := a2.do(http.MethodGet, "/alunos/me/progresso/exercicio/"+c2.exercicio.String()+"/sugestao", nil, c2.tokAluno)
		m := decodeMap(t, raw)
		if m["direcao"] != "MANTER" || m["rpe_considerado"] == nil {
			t.Errorf("%s", raw)
		}
	})

	t.Run("personal ve a sugestao do proprio aluno; de outro aluno e 404", func(t *testing.T) {
		st, raw := a.do(http.MethodGet, "/alunos/"+c.aluno.String()+"/progresso/exercicio/"+c.exercicio.String()+"/sugestao", nil, c.tokPersonal)
		if st != http.StatusOK || decodeMap(t, raw)["direcao"] != "AUMENTAR" {
			t.Errorf("%d %s", st, raw)
		}
		outro := a.cenario()
		if st, _ := a.do(http.MethodGet, "/alunos/"+outro.aluno.String()+"/progresso/exercicio/"+c.exercicio.String()+"/sugestao", nil, c.tokPersonal); st != http.StatusNotFound {
			t.Errorf("aluno alheio: %d, want 404", st)
		}
	})

	t.Run("exercicio invisivel e id malformado", func(t *testing.T) {
		if st, _ := a.do(http.MethodGet, "/alunos/me/progresso/exercicio/"+uuid.NewString()+"/sugestao", nil, c.tokAluno); st != http.StatusNotFound {
			t.Errorf("inexistente: %d, want 404", st)
		}
		if st, _ := a.do(http.MethodGet, "/alunos/me/progresso/exercicio/xyz/sugestao", nil, c.tokAluno); st != http.StatusBadRequest {
			t.Errorf("malformado: %d, want 400", st)
		}
	})
}

// ── Dashboard ──────────────────────────────────────────────────────────────

func TestDashboard_PeloEndpoint(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	outro := a.cenario()
	a.sessaoComSerie(c, diaUTC(-3), 1, 50, 10, nil)  // dentro de 7 e 30 dias
	a.sessaoComSerie(c, diaUTC(-20), 1, 50, 10, nil) // so 30 dias
	a.sessaoComSerie(outro, diaUTC(-1), 1, 50, 10, nil)
	semTreinar := a.seed.Aluno(c.personal) // ativo, sem sessoes
	_ = semTreinar

	st, raw := a.do(http.MethodGet, "/dashboard", nil, c.tokPersonal)
	if st != http.StatusOK {
		t.Fatalf("%d %s", st, raw)
	}
	got := decodeMap(t, raw)
	want := json2{
		"alunos_ativos": 2.0, "fichas_ativas": 1.0, "sessoes_ultimos_7_dias": 1.0,
		"sessoes_ultimos_30_dias": 2.0, "alunos_sem_sessao_7_dias": 1.0,
	}
	for k, v := range want {
		if got[k] != v {
			t.Errorf("%s = %v, want %v (%s)", k, got[k], v, raw)
		}
	}
}

// ── Anamnese ───────────────────────────────────────────────────────────────

// respostasIntermediario soma 50 pontos (20+15+10+0+5) => INTERMEDIARIO, objetivo hipertrofia.
func respostasIntermediario() json2 {
	return json2{
		"frequencia_semanal": "3_4_dias", "experiencia_meses": "6_meses_2_anos",
		"objetivo": "hipertrofia", "restricoes": "nao", "disponibilidade": "3_dias",
	}
}

func anamnese(respostas json2, extra json2) json2 {
	body := json2{"objetivo": "ganhar massa", "respostas": respostas}
	for k, v := range extra {
		body[k] = v
	}
	return body
}

func TestAnamnese_ScoreNivelETemplateSugerido(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	path := "/alunos/" + c.aluno.String() + "/anamnese"

	st, raw := a.do(http.MethodPost, path, anamnese(respostasIntermediario(), json2{"lesoes": "joelho", "frequencia_semanas_anterior": 3}), c.tokPersonal)
	if st != http.StatusCreated {
		t.Fatalf("registrar: %d %s", st, raw)
	}
	m := decodeMap(t, raw)
	if m["score_calculado"] != 50.0 || m["nivel_sugerido"] != "INTERMEDIARIO" || m["lesoes"] != "joelho" {
		t.Errorf("score/nivel: %s", raw)
	}
	if m["template_ficha_nome"] != "Hipertrofia AB Intermediário" {
		t.Errorf("deveria sugerir o template de sistema de hipertrofia/intermediario: %s", raw)
	}
	resp := m["respostas"].(json2)
	if resp["frequencia_semanal"].(json2)["pontos"] != 20.0 {
		t.Errorf("pontos resolvidos no backend: %v", resp)
	}

	t.Run("pontos enviados pelo cliente sao ignorados", func(t *testing.T) {
		body := anamnese(respostasIntermediario(), json2{"score_calculado": 999, "nivel_sugerido": "AVANCADO", "pontos": 999})
		_, raw := a.do(http.MethodPost, path, body, c.tokPersonal)
		m := decodeMap(t, raw)
		if m["score_calculado"] != 50.0 || m["nivel_sugerido"] != "INTERMEDIARIO" {
			t.Errorf("o cliente nao pode ditar o score: %s", raw)
		}
	})

	t.Run("template custom do personal tem prioridade sobre o do sistema", func(t *testing.T) {
		tplID := uuid.New()
		a.seed.Exec(`INSERT INTO template_treino (id, nome, nivel, objetivo, criado_por, personal_id, ativo)
		             VALUES ($1, 'Meu modelo de hipertrofia', 'INTERMEDIARIO', 'hipertrofia', 'PERSONAL', $2, TRUE)`, tplID, c.personal)
		_, raw := a.do(http.MethodPost, path, anamnese(respostasIntermediario(), nil), c.tokPersonal)
		m := decodeMap(t, raw)
		if m["template_ficha_id"] != tplID.String() {
			t.Errorf("deveria preferir o template do proprio personal: %s", raw)
		}
	})

	t.Run("sem template compativel nao sugere nenhum", func(t *testing.T) {
		r := respostasIntermediario()
		r["objetivo"] = "emagrecimento" // sem template de INTERMEDIARIO/emagrecimento na seed
		_, raw := a.do(http.MethodPost, path, anamnese(r, nil), c.tokPersonal)
		m := decodeMap(t, raw)
		if m["template_ficha_id"] != nil {
			t.Errorf("nao deveria sugerir template: %s", raw)
		}
	})
}

func TestAnamnese_NiveisPelasFaixas(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	path := "/alunos/" + c.aluno.String() + "/anamnese"

	casos := []struct {
		nome      string
		respostas json2
		score     float64
		nivel     string
	}{
		{"iniciante com restricao (pode ser negativo)", json2{"frequencia_semanal": "sedentario", "experiencia_meses": "nunca_treinei", "objetivo": "emagrecimento", "restricoes": "sim", "disponibilidade": "2_dias"}, -10, "INICIANTE"},
		{"avancado", json2{"frequencia_semanal": "5_mais_dias", "experiencia_meses": "mais_2_anos", "objetivo": "performance_forca", "restricoes": "nao", "disponibilidade": "4_5_dias"}, 80, "AVANCADO"},
		{"limite 30 ainda e iniciante", json2{"frequencia_semanal": "3_4_dias", "experiencia_meses": "menos_6_meses", "objetivo": "condicionamento_geral", "restricoes": "nao", "disponibilidade": "2_dias"}, 30, "INICIANTE"},
		{"limite 31 ja e intermediario", json2{"frequencia_semanal": "3_4_dias", "experiencia_meses": "menos_6_meses", "objetivo": "condicionamento_geral", "restricoes": "nao", "disponibilidade": "3_dias"}, 35, "INTERMEDIARIO"},
	}
	for _, k := range casos {
		st, raw := a.do(http.MethodPost, path, anamnese(k.respostas, nil), c.tokPersonal)
		m := decodeMap(t, raw)
		if st != http.StatusCreated || m["score_calculado"] != k.score || m["nivel_sugerido"] != k.nivel {
			t.Errorf("%s: %d score=%v nivel=%v, want %v/%s", k.nome, st, m["score_calculado"], m["nivel_sugerido"], k.score, k.nivel)
		}
	}
}

func TestAnamnese_ValidacaoEAcesso(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	outro := a.cenario()
	path := "/alunos/" + c.aluno.String() + "/anamnese"

	t.Run("opcao de resposta desconhecida: 422", func(t *testing.T) {
		r := respostasIntermediario()
		r["frequencia_semanal"] = "todo_dia"
		if st, _ := a.do(http.MethodPost, path, anamnese(r, nil), c.tokPersonal); st != http.StatusUnprocessableEntity {
			t.Errorf("%d, want 422", st)
		}
	})
	t.Run("campos obrigatorios e limites", func(t *testing.T) {
		semResposta := respostasIntermediario()
		delete(semResposta, "disponibilidade")
		for nome, body := range map[string]json2{
			"sem objetivo":          {"respostas": respostasIntermediario()},
			"objetivo curto":        anamnese(respostasIntermediario(), json2{"objetivo": "x"}),
			"sem uma das respostas": anamnese(semResposta, nil),
			"frequencia anterior 8": anamnese(respostasIntermediario(), json2{"frequencia_semanas_anterior": 8}),
			"lesoes longas":         anamnese(respostasIntermediario(), json2{"lesoes": strings.Repeat("x", 1001)}),
		} {
			if st, _ := a.do(http.MethodPost, path, body, c.tokPersonal); st != http.StatusUnprocessableEntity {
				t.Errorf("%s: %d, want 422", nome, st)
			}
		}
		if st, _ := a.do(http.MethodPost, path, "{nao e json", c.tokPersonal); st != http.StatusBadRequest {
			t.Errorf("JSON invalido: %d, want 400", st)
		}
	})
	t.Run("aluno de outro personal ou desativado: 404 e nada e gravado", func(t *testing.T) {
		if st, _ := a.do(http.MethodPost, "/alunos/"+outro.aluno.String()+"/anamnese", anamnese(respostasIntermediario(), nil), c.tokPersonal); st != http.StatusNotFound {
			t.Errorf("aluno alheio: %d, want 404", st)
		}
		if st, _ := a.do(http.MethodPost, "/alunos/xyz/anamnese", anamnese(respostasIntermediario(), nil), c.tokPersonal); st != http.StatusBadRequest {
			t.Errorf("alunoId malformado: %d, want 400", st)
		}
		var n int
		if err := a.seed.Pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM anamnese WHERE aluno_id = $1`, outro.aluno).Scan(&n); err != nil || n != 0 {
			t.Errorf("anamnese gravada para aluno alheio: %d (err=%v)", n, err)
		}
	})
}

func TestAnamnese_ObterEReavaliar(t *testing.T) {
	a := novaAPI(t)
	c := a.cenario()
	outro := a.cenario()
	path := "/alunos/" + c.aluno.String() + "/anamnese"

	if st, _ := a.do(http.MethodGet, path, nil, c.tokPersonal); st != http.StatusNotFound {
		t.Errorf("sem anamnese: %d, want 404", st)
	}

	_, raw := a.do(http.MethodPost, path, anamnese(respostasIntermediario(), nil), c.tokPersonal)
	primeira := decodeMap(t, raw)

	novas := respostasIntermediario()
	novas["frequencia_semanal"] = "5_mais_dias" // +10 => 60, ainda intermediario
	_, raw = a.do(http.MethodPost, path, anamnese(novas, json2{"objetivo": "performance"}), c.tokPersonal)
	segunda := decodeMap(t, raw)
	if segunda["id"] != primeira["id"] || segunda["preenchido_em"] != primeira["preenchido_em"] || segunda["score_calculado"] != 60.0 {
		t.Errorf("reavaliacao deve manter id/preenchido_em e atualizar o score: %v -> %v", primeira, segunda)
	}

	st, raw := a.do(http.MethodGet, path, nil, c.tokPersonal)
	got := decodeMap(t, raw)
	if st != http.StatusOK || got["objetivo"] != "performance" || got["score_calculado"] != 60.0 {
		t.Errorf("GET: %d %s", st, raw)
	}
	if got["template_ficha_id"] != nil {
		t.Errorf("o GET devolve so a anamnese salva, sem recalcular template: %s", raw)
	}
	if st, _ := a.do(http.MethodGet, "/alunos/"+outro.aluno.String()+"/anamnese", nil, c.tokPersonal); st != http.StatusNotFound {
		t.Errorf("anamnese de aluno alheio: %d, want 404", st)
	}
}
