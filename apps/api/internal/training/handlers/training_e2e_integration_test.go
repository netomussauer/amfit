//go:build integration

package handlers_test

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"io"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/amfit/api/internal/testsupport/pgtest"
	"github.com/amfit/api/internal/training/application"
	"github.com/amfit/api/internal/training/handlers"
	"github.com/amfit/api/internal/training/infrastructure"
	"github.com/amfit/api/pkg/auth"
	"github.com/amfit/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Pilha real do Training: handlers + service + repositorios no PostgreSQL de
// teste + middleware JWT + role guards. Nada e falso.

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
	r := infrastructure.NewPostgresRepositories(pool)
	svc := application.NewTrainingService(
		r.Fichas, r.Treinos, r.Itens, r.FichaCompleta, r.TreinoHoje, r.AlunoLookup, r.Templates, r.SessaoHoje,
	)
	h := handlers.NewTrainingHandler(svc)

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

type obj = map[string]any

func decode(t *testing.T, raw []byte) obj {
	t.Helper()
	var m obj
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatalf("JSON invalido: %s (%v)", raw, err)
	}
	return m
}

// ator: personal + aluno + tokens.
type ator struct {
	personal, aluno uuid.UUID
	tokP, tokA      string
}

func (a *api) ator() ator {
	p := a.seed.Personal()
	al := a.seed.Aluno(p)
	return ator{p, al, a.token(p, "PERSONAL", p), a.token(al, "ALUNO", p)}
}

func (a *api) expect(status int, method, path string, body any, tok string) obj {
	a.t.Helper()
	st, raw := a.do(method, path, body, tok)
	if st != status {
		a.t.Fatalf("%s %s: %d (quer %d): %.300s", method, path, st, status, raw)
	}
	if len(raw) == 0 {
		return nil
	}
	var m obj
	_ = json.Unmarshal(raw, &m)
	return m
}

func hoje() string { return time.Now().UTC().Format("2006-01-02") }
func dia(n int) string {
	return time.Now().UTC().AddDate(0, 0, n).Format("2006-01-02")
}

func (a *api) ficha(x ator) string {
	m := a.expect(201, "POST", "/fichas", obj{"aluno_id": x.aluno.String(), "nome": "Ficha A", "vigencia_inicio": dia(-1)}, x.tokP)
	return m["id"].(string)
}

func (a *api) treino(x ator, ficha, letra string, ordem int) string {
	m := a.expect(201, "POST", "/fichas/"+ficha+"/treinos", obj{"letra": letra, "ordem": ordem}, x.tokP)
	return m["id"].(string)
}

func (a *api) item(x ator, treino string, exercicio uuid.UUID, ordem int) string {
	m := a.expect(201, "POST", "/treinos/"+treino+"/itens", obj{"exercicio_id": exercicio.String(), "ordem": ordem, "series": 3, "repeticoes": "10"}, x.tokP)
	return m["id"].(string)
}

func TestTraining_RotasExigemAutenticacaoERole(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	id := uuid.NewString()
	personal := [][2]string{
		{"POST", "/fichas"}, {"POST", "/fichas/from-template"}, {"GET", "/fichas"}, {"GET", "/fichas/" + id},
		{"PATCH", "/fichas/" + id}, {"DELETE", "/fichas/" + id}, {"POST", "/fichas/" + id + "/salvar-como-template"},
		{"GET", "/templates-treino"}, {"POST", "/fichas/" + id + "/treinos"}, {"PATCH", "/treinos/" + id},
		{"DELETE", "/treinos/" + id}, {"POST", "/treinos/" + id + "/itens"}, {"PATCH", "/treinos/" + id + "/itens/reordenar"},
		{"PATCH", "/itens/" + id}, {"DELETE", "/itens/" + id},
	}
	aluno := [][2]string{{"GET", "/alunos/me/treino-hoje"}, {"GET", "/alunos/me/ficha"}}
	for _, r := range append(append([][2]string{}, personal...), aluno...) {
		if st, _ := a.do(r[0], r[1], nil, ""); st != 401 {
			t.Errorf("%s %s sem token: %d, quer 401", r[0], r[1], st)
		}
	}
	for _, r := range personal {
		if st, _ := a.do(r[0], r[1], nil, x.tokA); st != 403 {
			t.Errorf("%s %s como ALUNO: %d, quer 403", r[0], r[1], st)
		}
	}
	for _, r := range aluno {
		if st, _ := a.do(r[0], r[1], nil, x.tokP); st != 403 {
			t.Errorf("%s %s como PERSONAL: %d, quer 403", r[0], r[1], st)
		}
	}
}

func TestTraining_Ficha_CicloCompleto(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()

	m := a.expect(201, "POST", "/fichas", obj{
		"aluno_id": x.aluno.String(), "nome": "  Hipertrofia  ", "vigencia_inicio": "2026-01-10", "vigencia_fim": "2026-03-10",
	}, x.tokP)
	id := m["id"].(string)
	if m["nome"] != "Hipertrofia" || m["vigencia_inicio"] != "2026-01-10" || m["vigencia_fim"] != "2026-03-10" || m["ativa"] != true || m["aluno_id"] != x.aluno.String() {
		t.Errorf("criada: %v", m)
	}

	// Detalhe e listagem.
	if g := a.expect(200, "GET", "/fichas/"+id, nil, x.tokP); g["nome"] != "Hipertrofia" || len(g["treinos"].([]any)) != 0 {
		t.Errorf("detalhe: %v", g)
	}
	if l := a.expect(200, "GET", "/fichas", nil, x.tokP); len(l["data"].([]any)) != 1 {
		t.Errorf("lista: %v", l)
	}

	// PATCH parcial, limpar vigencia_fim com "", desativar e reativar.
	p := a.expect(200, "PATCH", "/fichas/"+id, obj{"nome": "Forca", "vigencia_fim": ""}, x.tokP)
	if p["nome"] != "Forca" || p["vigencia_fim"] != nil || p["vigencia_inicio"] != "2026-01-10" {
		t.Errorf("patch: %v", p)
	}
	if p := a.expect(200, "PATCH", "/fichas/"+id, obj{"ativa": false}, x.tokP); p["ativa"] != false {
		t.Errorf("desativar via patch: %v", p)
	}
	if p := a.expect(200, "PATCH", "/fichas/"+id, obj{"ativa": true}, x.tokP); p["ativa"] != true {
		t.Errorf("reativar via patch: %v", p)
	}

	// DELETE e soft delete e idempotente.
	a.expect(204, "DELETE", "/fichas/"+id, nil, x.tokP)
	a.expect(204, "DELETE", "/fichas/"+id, nil, x.tokP)
	if g := a.expect(200, "GET", "/fichas/"+id, nil, x.tokP); g["ativa"] != false {
		t.Errorf("apos delete: %v", g)
	}
}

func TestTraining_Ficha_Validacao(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	y := a.ator()
	ok := func(over obj) obj {
		b := obj{"aluno_id": x.aluno.String(), "nome": "Ficha", "vigencia_inicio": hoje()}
		for k, v := range over {
			if v == nil {
				delete(b, k)
			} else {
				b[k] = v
			}
		}
		return b
	}
	casos := []struct {
		nome   string
		corpo  any
		status int
	}{
		{"sem aluno", ok(obj{"aluno_id": nil}), 422},
		{"aluno nao uuid", ok(obj{"aluno_id": "abc"}), 422},
		{"nome curto", ok(obj{"nome": "x"}), 422},
		{"sem inicio", ok(obj{"vigencia_inicio": nil}), 422},
		{"inicio formato errado", ok(obj{"vigencia_inicio": "10/01/2026"}), 422},
		{"fim formato errado", ok(obj{"vigencia_fim": "amanha"}), 422},
		{"json quebrado", "{x", 400},
		{"aluno de outro personal", ok(obj{"aluno_id": y.aluno.String()}), 404},
		{"aluno inexistente", ok(obj{"aluno_id": uuid.NewString()}), 404},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if st, raw := a.do("POST", "/fichas", c.corpo, x.tokP); st != c.status {
				t.Errorf("status %d, quer %d: %.200s", st, c.status, raw)
			}
		})
	}
	var n int
	_ = a.seed.Pool.QueryRow(a.seed.Ctx, `SELECT COUNT(*) FROM ficha_treino`).Scan(&n)
	if n != 0 {
		t.Errorf("fichas gravadas por pedidos invalidos: %d", n)
	}
}

func TestTraining_Ficha_PatchValidacao(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	id := a.ficha(x)

	if st, _ := a.do("PATCH", "/fichas/"+id, obj{"nome": "x"}, x.tokP); st != 422 {
		t.Errorf("nome curto: %d, quer 422", st)
	}
	if st, _ := a.do("PATCH", "/fichas/"+id, obj{"vigencia_inicio": "ontem"}, x.tokP); st != 422 {
		t.Errorf("inicio invalido: %d, quer 422", st)
	}
	// vigencia_fim nao tem tag de validacao no DTO: lixo vira erro 5xx em vez de 4xx.
	if st, raw := a.do("PATCH", "/fichas/"+id, obj{"vigencia_fim": "lixo"}, x.tokP); st < 400 || st >= 500 {
		t.Errorf("vigencia_fim invalida: %d %.200s, quer 4xx", st, raw)
	}
	if st, _ := a.do("PATCH", "/fichas/xx", obj{"nome": "Valido"}, x.tokP); st != 400 {
		t.Errorf("id invalido: %d, quer 400", st)
	}
}

func TestTraining_Ficha_IsolamentoEntrePersonals(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	y := a.ator()
	id := a.ficha(x)
	treino := a.treino(x, id, "A", 0)
	item := a.item(x, treino, a.seed.Exercicio("Supino", nil), 0)

	// Tudo que y tenta nas coisas de x e 404 (nao 403), e nada muda.
	tentativas := [][3]any{
		{"GET", "/fichas/" + id, nil},
		{"PATCH", "/fichas/" + id, obj{"nome": "Invadida"}},
		{"DELETE", "/fichas/" + id, nil},
		{"POST", "/fichas/" + id + "/salvar-como-template", obj{"nome": "Roubo", "nivel": "INICIANTE", "objetivo": "forca"}},
		{"POST", "/fichas/" + id + "/treinos", obj{"letra": "B"}},
		{"PATCH", "/treinos/" + treino, obj{"nome": "Invadido"}},
		{"DELETE", "/treinos/" + treino, nil},
		{"POST", "/treinos/" + treino + "/itens", obj{"exercicio_id": a.seed.Exercicio("Outro", nil).String(), "series": 3, "repeticoes": "10"}},
		{"PATCH", "/treinos/" + treino + "/itens/reordenar", obj{"ids": []string{item}}},
		{"PATCH", "/itens/" + item, obj{"series": 9}},
		{"DELETE", "/itens/" + item, nil},
	}
	for _, tt := range tentativas {
		if st, raw := a.do(tt[0].(string), tt[1].(string), tt[2], y.tokP); st != 404 {
			t.Errorf("%s %s por outro personal: %d %.120s, quer 404", tt[0], tt[1], st, raw)
		}
	}
	if l := a.expect(200, "GET", "/fichas", nil, y.tokP); len(l["data"].([]any)) != 0 {
		t.Errorf("lista do outro personal: %v", l)
	}
	g := a.expect(200, "GET", "/fichas/"+id, nil, x.tokP)
	tr := g["treinos"].([]any)
	if g["nome"] != "Ficha A" || g["ativa"] != true || len(tr) != 1 || len(tr[0].(obj)["itens"].([]any)) != 1 || tr[0].(obj)["itens"].([]any)[0].(obj)["series"] != float64(3) {
		t.Errorf("ficha de x foi alterada: %v", g)
	}
}

func TestTraining_Listar_Filtros(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	outroAluno := a.seed.Aluno(x.personal)
	f1 := a.ficha(x)
	a.expect(201, "POST", "/fichas", obj{"aluno_id": outroAluno.String(), "nome": "Do outro", "vigencia_inicio": hoje()}, x.tokP)
	a.expect(204, "DELETE", "/fichas/"+f1, nil, x.tokP)

	n := func(q string) int {
		return len(a.expect(200, "GET", "/fichas"+q, nil, x.tokP)["data"].([]any))
	}
	if n("") != 2 || n("?ativa=true") != 1 || n("?ativa=false") != 1 || n("?aluno_id="+x.aluno.String()) != 1 || n("?aluno_id="+x.aluno.String()+"&ativa=true") != 0 {
		t.Errorf("filtros: todas=%d ativas=%d inativas=%d aluno=%d", n(""), n("?ativa=true"), n("?ativa=false"), n("?aluno_id="+x.aluno.String()))
	}
	if st, _ := a.do("GET", "/fichas?aluno_id=zz", nil, x.tokP); st != 400 {
		t.Errorf("aluno_id invalido: %d", st)
	}
	if st, _ := a.do("GET", "/fichas?ativa=talvez", nil, x.tokP); st != 400 {
		t.Errorf("ativa invalido: %d", st)
	}
	// total_treinos aparece na listagem.
	f3 := a.expect(200, "GET", "/fichas?ativa=false", nil, x.tokP)["data"].([]any)[0].(obj)
	if f3["total_treinos"] != float64(0) {
		t.Errorf("total_treinos: %v", f3)
	}
}

func TestTraining_Treinos(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	ficha := a.ficha(x)

	m := a.expect(201, "POST", "/fichas/"+ficha+"/treinos", obj{"letra": "b", "nome": " Peito ", "ordem": 1}, x.tokP)
	id := m["id"].(string)
	if m["letra"] != "B" || m["nome"] != "Peito" || m["ordem"] != float64(1) {
		t.Errorf("criado (letra normalizada em maiuscula): %v", m)
	}

	// Letra repetida na mesma ficha: 409; em outra ficha, pode.
	if st, _ := a.do("POST", "/fichas/"+ficha+"/treinos", obj{"letra": "B"}, x.tokP); st != 409 {
		t.Errorf("letra repetida: %d, quer 409", st)
	}
	outra := a.expect(201, "POST", "/fichas", obj{"aluno_id": x.aluno.String(), "nome": "Outra", "vigencia_inicio": hoje()}, x.tokP)["id"].(string)
	a.expect(201, "POST", "/fichas/"+outra+"/treinos", obj{"letra": "B"}, x.tokP)

	// PATCH parcial; trocar para letra existente => 409.
	a.expect(201, "POST", "/fichas/"+ficha+"/treinos", obj{"letra": "C", "ordem": 2}, x.tokP)
	if p := a.expect(200, "PATCH", "/treinos/"+id, obj{"nome": "Peito e triceps"}, x.tokP); p["letra"] != "B" || p["nome"] != "Peito e triceps" {
		t.Errorf("patch parcial: %v", p)
	}
	if st, _ := a.do("PATCH", "/treinos/"+id, obj{"letra": "c"}, x.tokP); st != 409 {
		t.Errorf("patch para letra existente: %d, quer 409", st)
	}

	// Validacao.
	for nome, corpo := range map[string]obj{"sem letra": {}, "letra longa": {"letra": "ABC"}, "nome longo": {"letra": "Z", "nome": strings.Repeat("n", 101)}} {
		if st, _ := a.do("POST", "/fichas/"+ficha+"/treinos", corpo, x.tokP); st != 422 {
			t.Errorf("%s: %d, quer 422", nome, st)
		}
	}
	if st, _ := a.do("POST", "/fichas/xx/treinos", obj{"letra": "Z"}, x.tokP); st != 400 {
		t.Errorf("ficha id invalido: %d", st)
	}
	if st, _ := a.do("POST", "/fichas/"+uuid.NewString()+"/treinos", obj{"letra": "Z"}, x.tokP); st != 404 {
		t.Errorf("ficha inexistente: %d", st)
	}
	if st, _ := a.do("PATCH", "/treinos/"+uuid.NewString(), obj{"nome": "n"}, x.tokP); st != 404 {
		t.Errorf("treino inexistente: %d", st)
	}

	// DELETE remove o treino e os itens em cascata.
	ex := a.seed.Exercicio("Cascata", nil)
	a.item(x, id, ex, 0)
	a.expect(204, "DELETE", "/treinos/"+id, nil, x.tokP)
	var itens int
	_ = a.seed.Pool.QueryRow(a.seed.Ctx, `SELECT COUNT(*) FROM item_treino WHERE treino_id=$1`, id).Scan(&itens)
	if itens != 0 {
		t.Errorf("itens orfaos: %d", itens)
	}
	if st, _ := a.do("DELETE", "/treinos/"+id, nil, x.tokP); st != 404 {
		t.Errorf("delete repetido: %d, quer 404", st)
	}
}

func TestTraining_Itens(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	ficha := a.ficha(x)
	treino := a.treino(x, ficha, "A", 0)
	ex := a.seed.Exercicio("Agachamento Z", nil)

	m := a.expect(201, "POST", "/treinos/"+treino+"/itens", obj{
		"exercicio_id": ex.String(), "ordem": 0, "series": 4, "repeticoes": " 8-12 ", "carga_sugerida": 60.5, "descanso_segundos": 90, "observacao": " devagar ",
	}, x.tokP)
	id := m["id"].(string)
	if m["series"] != float64(4) || m["repeticoes"] != "8-12" || m["carga_sugerida"] != 60.5 || m["descanso_segundos"] != float64(90) || m["observacao"] != "devagar" || m["exercicio"].(obj)["id"] != ex.String() {
		t.Errorf("criado: %v", m)
	}

	// A ficha completa traz o exercicio enriquecido.
	g := a.expect(200, "GET", "/fichas/"+ficha, nil, x.tokP)
	it := g["treinos"].([]any)[0].(obj)["itens"].([]any)[0].(obj)
	if e := it["exercicio"].(obj); e["nome"] != "Agachamento Z" || e["grupo_muscular"].(obj)["nome"] == "" || e["is_global"] != true {
		t.Errorf("exercicio enriquecido: %v", it)
	}

	// PATCH parcial.
	if p := a.expect(200, "PATCH", "/itens/"+id, obj{"series": 5, "observacao": ""}, x.tokP); p["series"] != float64(5) || p["repeticoes"] != "8-12" || p["observacao"] != nil {
		t.Errorf("patch: %v", p)
	}

	casos := []struct {
		nome  string
		corpo obj
		st    int
	}{
		{"sem exercicio", obj{"series": 3, "repeticoes": "10"}, 422},
		{"exercicio nao uuid", obj{"exercicio_id": "x", "series": 3, "repeticoes": "10"}, 422},
		{"series zero", obj{"exercicio_id": ex.String(), "series": 0, "repeticoes": "10"}, 422},
		{"series 21", obj{"exercicio_id": ex.String(), "series": 21, "repeticoes": "10"}, 422},
		{"sem repeticoes", obj{"exercicio_id": ex.String(), "series": 3}, 422},
		{"descanso 601", obj{"exercicio_id": ex.String(), "series": 3, "repeticoes": "10", "descanso_segundos": 601}, 422},
		{"observacao longa", obj{"exercicio_id": ex.String(), "series": 3, "repeticoes": "10", "observacao": strings.Repeat("o", 501)}, 422},
		{"exercicio inexistente", obj{"exercicio_id": uuid.NewString(), "series": 3, "repeticoes": "10"}, 422},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if st, raw := a.do("POST", "/treinos/"+treino+"/itens", c.corpo, x.tokP); st != c.st {
				t.Errorf("status %d, quer %d: %.200s", st, c.st, raw)
			}
		})
	}
	if st, _ := a.do("PATCH", "/itens/"+id, obj{"series": 21}, x.tokP); st != 422 {
		t.Errorf("patch series 21: %d", st)
	}
	if st, _ := a.do("PATCH", "/itens/"+uuid.NewString(), obj{"series": 3}, x.tokP); st != 404 {
		t.Errorf("patch inexistente: %d", st)
	}
	if st, _ := a.do("POST", "/treinos/"+uuid.NewString()+"/itens", obj{"exercicio_id": ex.String(), "series": 3, "repeticoes": "10"}, x.tokP); st != 404 {
		t.Errorf("treino inexistente: %d", st)
	}

	a.expect(204, "DELETE", "/itens/"+id, nil, x.tokP)
	if st, _ := a.do("DELETE", "/itens/"+id, nil, x.tokP); st != 404 {
		t.Errorf("delete repetido: %d", st)
	}
}

// Prescrever um exercicio PRIVADO de outro personal vazaria o nome dele no GET
// da ficha: o exercicio precisa ser global ou do proprio personal.
func TestTraining_Itens_ExercicioPrivadoDeOutroPersonal(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	y := a.ator()
	treino := a.treino(x, a.ficha(x), "A", 0)
	alheio := a.seed.Exercicio("Segredo do Y", &y.personal)
	proprio := a.seed.Exercicio("Meu", &x.personal)

	if st, raw := a.do("POST", "/treinos/"+treino+"/itens", obj{"exercicio_id": alheio.String(), "series": 3, "repeticoes": "10"}, x.tokP); st != 422 {
		t.Errorf("exercicio privado de outro personal: %d %.200s, quer 422", st, raw)
	}
	a.expect(201, "POST", "/treinos/"+treino+"/itens", obj{"exercicio_id": proprio.String(), "series": 3, "repeticoes": "10"}, x.tokP)
}

func TestTraining_ReordenarItens(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	ficha := a.ficha(x)
	treino := a.treino(x, ficha, "A", 0)
	outroTreino := a.treino(x, ficha, "B", 1)
	var ids [3]string
	for i := range ids {
		ids[i] = a.item(x, treino, a.seed.Exercicio("Ex"+string(rune('A'+i)), nil), i)
	}
	alheio := a.item(x, outroTreino, a.seed.Exercicio("Alheio", nil), 0)

	ordem := func() []string {
		g := a.expect(200, "GET", "/fichas/"+ficha, nil, x.tokP)
		var out []string
		for _, i := range g["treinos"].([]any)[0].(obj)["itens"].([]any) {
			out = append(out, i.(obj)["id"].(string))
		}
		return out
	}

	a.expect(204, "PATCH", "/treinos/"+treino+"/itens/reordenar", obj{"ids": []string{ids[2], ids[0], ids[1]}}, x.tokP)
	if got := ordem(); got[0] != ids[2] || got[1] != ids[0] || got[2] != ids[1] {
		t.Errorf("ordem apos reordenar: %v", got)
	}

	// Listas inconsistentes: faltando item, item de outro treino, repetido, vazia.
	for nome, lista := range map[string][]string{
		"faltando":       {ids[0], ids[1]},
		"item de outro":  {ids[0], ids[1], alheio},
		"repetido":       {ids[0], ids[0], ids[1]},
		"a mais":         {ids[0], ids[1], ids[2], alheio},
		"id inexistente": {ids[0], ids[1], uuid.NewString()},
	} {
		if st, raw := a.do("PATCH", "/treinos/"+treino+"/itens/reordenar", obj{"ids": lista}, x.tokP); st != 422 {
			t.Errorf("%s: %d %.150s, quer 422", nome, st, raw)
		}
	}
	if st, _ := a.do("PATCH", "/treinos/"+treino+"/itens/reordenar", obj{"ids": []string{}}, x.tokP); st != 422 {
		t.Errorf("lista vazia: %d, quer 422", st)
	}
	if st, _ := a.do("PATCH", "/treinos/"+treino+"/itens/reordenar", obj{"ids": []string{"x"}}, x.tokP); st != 422 {
		t.Errorf("id nao uuid: %d, quer 422", st)
	}
	if st, _ := a.do("PATCH", "/treinos/"+uuid.NewString()+"/itens/reordenar", obj{"ids": []string{ids[0]}}, x.tokP); st != 404 {
		t.Errorf("treino inexistente: %d", st)
	}
	// Nenhuma tentativa invalida pode ter bagunçado a ordem.
	if got := ordem(); got[0] != ids[2] || got[1] != ids[0] || got[2] != ids[1] {
		t.Errorf("ordem alterada por pedido invalido: %v", got)
	}
}

func TestTraining_Templates_SalvarListarAplicar(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	y := a.ator()
	ficha := a.ficha(x)

	salvar := func(corpo obj) (int, obj) {
		st, raw := a.do("POST", "/fichas/"+ficha+"/salvar-como-template", corpo, x.tokP)
		var m obj
		_ = json.Unmarshal(raw, &m)
		return st, m
	}
	valido := obj{"nome": "Meu ABC", "nivel": "INTERMEDIARIO", "objetivo": "hipertrofia"}

	// Ficha sem itens nao vira template.
	if st, _ := salvar(valido); st != 422 {
		t.Errorf("ficha sem itens: %d, quer 422", st)
	}
	tA := a.treino(x, ficha, "A", 0)
	tB := a.treino(x, ficha, "B", 1)
	a.item(x, tA, a.seed.Exercicio("T1", nil), 0)
	a.item(x, tA, a.seed.Exercicio("T2", nil), 1)
	a.item(x, tB, a.seed.Exercicio("T3", nil), 0)

	for nome, corpo := range map[string]obj{
		"nome so espacos": {"nome": "   ", "nivel": "INICIANTE", "objetivo": "forca"},
		"nivel invalido":  {"nome": "ok", "nivel": "PRO", "objetivo": "forca"},
		"objetivo errado": {"nome": "ok", "nivel": "AVANCADO", "objetivo": "yoga"},
		"sem nivel":       {"nome": "ok", "objetivo": "forca"},
	} {
		if st, _ := salvar(corpo); st != 422 {
			t.Errorf("%s: %d, quer 422", nome, st)
		}
	}

	st, tpl := salvar(valido)
	if st != 201 {
		t.Fatalf("salvar: %d %v", st, tpl)
	}
	if tpl["nome"] != "Meu ABC" || tpl["nivel"] != "INTERMEDIARIO" || tpl["objetivo"] != "hipertrofia" || tpl["criado_por"] != "PERSONAL" || len(tpl["itens"].([]any)) != 3 {
		t.Errorf("template: %v", tpl)
	}
	tplID := tpl["id"].(string)

	// Listagem: o dono ve o template; outro personal nao. Filtros funcionam.
	tem := func(tok, q string) bool {
		for _, e := range a.expect(200, "GET", "/templates-treino"+q, nil, tok)["data"].([]any) {
			if e.(obj)["id"] == tplID {
				return true
			}
		}
		return false
	}
	if !tem(x.tokP, "") || tem(y.tokP, "") {
		t.Error("visibilidade do template customizado")
	}
	if !tem(x.tokP, "?nivel=INTERMEDIARIO&objetivo=hipertrofia") || tem(x.tokP, "?nivel=AVANCADO") || tem(x.tokP, "?objetivo=forca") {
		t.Error("filtros de template")
	}

	// Aplicar: copia treinos/itens para o aluno (sem nome => usa o do template).
	novaFicha := a.expect(201, "POST", "/fichas/from-template", obj{"template_id": tplID, "aluno_id": x.aluno.String(), "vigencia_inicio": hoje()}, x.tokP)
	if novaFicha["nome"] == "" || novaFicha["id"] == ficha || len(novaFicha["treinos"].([]any)) != 2 {
		t.Errorf("ficha do template: %v", novaFicha)
	}
	trs := novaFicha["treinos"].([]any)
	if len(trs[0].(obj)["itens"].([]any)) != 2 || len(trs[1].(obj)["itens"].([]any)) != 1 {
		t.Errorf("itens copiados: %v", trs)
	}
	// Com nome explicito.
	if f := a.expect(201, "POST", "/fichas/from-template", obj{"template_id": tplID, "aluno_id": x.aluno.String(), "nome": "Personalizada", "vigencia_inicio": hoje()}, x.tokP); f["nome"] != "Personalizada" {
		t.Errorf("nome explicito: %v", f["nome"])
	}

	// Erros.
	casos := []struct {
		nome  string
		corpo obj
		tok   string
		st    int
	}{
		{"template de outro personal", obj{"template_id": tplID, "aluno_id": y.aluno.String(), "vigencia_inicio": hoje()}, y.tokP, 404},
		{"aluno de outro personal", obj{"template_id": tplID, "aluno_id": y.aluno.String(), "vigencia_inicio": hoje()}, x.tokP, 404},
		{"template inexistente", obj{"template_id": uuid.NewString(), "aluno_id": x.aluno.String(), "vigencia_inicio": hoje()}, x.tokP, 404},
		{"sem template", obj{"aluno_id": x.aluno.String(), "vigencia_inicio": hoje()}, x.tokP, 422},
		{"inicio invalido", obj{"template_id": tplID, "aluno_id": x.aluno.String(), "vigencia_inicio": "x"}, x.tokP, 422},
	}
	for _, c := range casos {
		if st, raw := a.do("POST", "/fichas/from-template", c.corpo, c.tok); st != c.st {
			t.Errorf("%s: %d %.150s, quer %d", c.nome, st, raw, c.st)
		}
	}
}

func TestTraining_Aluno_FichaETreinoHoje(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()

	// Sem ficha: 204 nas duas.
	a.expect(204, "GET", "/alunos/me/ficha", nil, x.tokA)
	a.expect(204, "GET", "/alunos/me/treino-hoje", nil, x.tokA)

	// Ficha vigente sem treinos: ficha 200, treino-hoje 204.
	ficha := a.ficha(x)
	if f := a.expect(200, "GET", "/alunos/me/ficha", nil, x.tokA); f["id"] != ficha {
		t.Errorf("ficha do aluno: %v", f)
	}
	a.expect(204, "GET", "/alunos/me/treino-hoje", nil, x.tokA)

	// Com treinos A e B: o primeiro da sequencia e o A.
	tA := a.treino(x, ficha, "A", 0)
	tB := a.treino(x, ficha, "B", 1)
	a.item(x, tA, a.seed.Exercicio("HA", nil), 0)
	a.item(x, tB, a.seed.Exercicio("HB", nil), 0)

	h := a.expect(200, "GET", "/alunos/me/treino-hoje", nil, x.tokA)
	if h["treino"].(obj)["id"] != tA || h["sessao_hoje_id"] != nil {
		t.Errorf("primeiro treino: %v", h)
	}

	// Sessao EM_ANDAMENTO hoje no A: o "Continuar" traz o id da sessao.
	sessao := a.seed.Sessao(x.aluno, uuid.MustParse(tA), a.seed.Hoje(), "EM_ANDAMENTO", nil)
	if h := a.expect(200, "GET", "/alunos/me/treino-hoje", nil, x.tokA); h["sessao_hoje_id"] != sessao.String() || h["treino"].(obj)["id"] != tA {
		t.Errorf("com sessao em andamento: %v", h)
	}

	// Conclui o A: a rotacao avanca para o B e sessao_hoje_id some.
	agora := time.Now()
	a.seed.Exec(`UPDATE sessao_treino SET status='CONCLUIDO', concluido_em=$2 WHERE id=$1`, sessao, agora)
	if h := a.expect(200, "GET", "/alunos/me/treino-hoje", nil, x.tokA); h["treino"].(obj)["id"] != tB || h["sessao_hoje_id"] != nil {
		t.Errorf("apos concluir A: %v", h)
	}

	// Ficha desativada some para o aluno.
	a.expect(204, "DELETE", "/fichas/"+ficha, nil, x.tokP)
	a.expect(204, "GET", "/alunos/me/ficha", nil, x.tokA)
	a.expect(204, "GET", "/alunos/me/treino-hoje", nil, x.tokA)
}

func TestTraining_Aluno_NaoVeFichaDeOutro(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	y := a.ator()
	a.treino(y, a.ficha(y), "A", 0)
	a.expect(204, "GET", "/alunos/me/ficha", nil, x.tokA)
	a.expect(204, "GET", "/alunos/me/treino-hoje", nil, x.tokA)
}

// Duas requisicoes simultaneas criando a mesma letra na mesma ficha: uma vence,
// a outra recebe 409 (UNIQUE), nunca 500.
func TestTraining_Treino_LetraConcorrente(t *testing.T) {
	a := novaAPI(t)
	x := a.ator()
	for rodada := 0; rodada < 10; rodada++ {
		ficha := a.ficha(x)
		const n = 8
		codes := make([]int, n)
		var wg sync.WaitGroup
		for i := 0; i < n; i++ {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				codes[i], _ = a.do("POST", "/fichas/"+ficha+"/treinos", obj{"letra": "A"}, x.tokP)
			}(i)
		}
		wg.Wait()
		ok, conflito := 0, 0
		for _, c := range codes {
			switch c {
			case 201:
				ok++
			case 409:
				conflito++
			default:
				t.Errorf("rodada %d: status inesperado %d (%v)", rodada, c, codes)
			}
		}
		if ok != 1 || conflito != n-1 {
			t.Errorf("rodada %d: %d x 201, %d x 409", rodada, ok, conflito)
		}
	}
}
