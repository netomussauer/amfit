//go:build integration

package handlers_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"
	"time"

	"github.com/amfit/api/internal/catalog/application"
	"github.com/amfit/api/internal/catalog/handlers"
	"github.com/amfit/api/internal/catalog/infrastructure"
	"github.com/amfit/api/internal/testsupport/pgtest"
	"github.com/amfit/api/pkg/auth"
	"github.com/amfit/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Pilha real do Catalog: handlers + service + repositorios no PostgreSQL de
// teste + middleware JWT. Falso so o storage de midia (MinIO).

type fakeStorage struct {
	uploads []uuid.UUID
	bytes   int
}

func (f *fakeStorage) UploadMidia(_ context.Context, id uuid.UUID, m *application.MidiaUpload) (string, error) {
	b, err := io.ReadAll(m.Reader)
	if err != nil {
		return "", err
	}
	f.uploads = append(f.uploads, id)
	f.bytes += len(b)
	return "http://midia.test/" + id.String(), nil
}

type api struct {
	t       *testing.T
	app     *fiber.App
	seed    *pgtest.Seed
	priv    *rsa.PrivateKey
	storage *fakeStorage
}

func novaAPI(t *testing.T) *api {
	t.Helper()
	pool := pgtest.NewDB(t)
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	repos := infrastructure.NewPostgresRepositories(pool)
	storage := &fakeStorage{}
	svc := application.NewCatalogService(repos.GruposMusculares, repos.Exercicios, storage)

	app := fiber.New(fiber.Config{BodyLimit: handlers.MaxRequestBodyBytes})
	handlers.NewCatalogHandler(svc).Register(app, middleware.NewAuthMiddleware(&priv.PublicKey))

	return &api{t: t, app: app, seed: pgtest.NewSeed(t, pool), priv: priv, storage: storage}
}

func (a *api) token(sub uuid.UUID, role string, tenant uuid.UUID) string {
	tok, err := auth.SignToken(jwt.MapClaims{"sub": sub.String(), "role": role, "tenant_id": tenant.String()}, a.priv)
	if err != nil {
		a.t.Fatal(err)
	}
	return tok
}

func (a *api) send(req *http.Request, token string) (int, []byte) {
	a.t.Helper()
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
	return a.send(req, token)
}

type arquivo struct {
	nome, contentType string
	conteudo          []byte
}

// multipartPost monta POST /exercicios multipart com campos e (opcional) midia.
func (a *api) multipartPost(campos map[string]string, f *arquivo, token string) (int, []byte) {
	a.t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	for k, v := range campos {
		if err := w.WriteField(k, v); err != nil {
			a.t.Fatal(err)
		}
	}
	if f != nil {
		h := textproto.MIMEHeader{}
		h.Set("Content-Disposition", `form-data; name="midia"; filename="`+f.nome+`"`)
		h.Set("Content-Type", f.contentType)
		part, err := w.CreatePart(h)
		if err != nil {
			a.t.Fatal(err)
		}
		_, _ = part.Write(f.conteudo)
	}
	if err := w.Close(); err != nil {
		a.t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/exercicios", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	return a.send(req, token)
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

func nomes(t *testing.T, raw []byte) []string {
	t.Helper()
	data, _ := decode(t, raw)["data"].([]any)
	out := make([]string, 0, len(data))
	for _, e := range data {
		out = append(out, e.(obj)["nome"].(string))
	}
	return out
}

func tem(lista []string, nome string) bool {
	for _, n := range lista {
		if n == nome {
			return true
		}
	}
	return false
}

func (a *api) personal() (uuid.UUID, string) {
	id := a.seed.Personal()
	return id, a.token(id, "PERSONAL", id)
}

func (a *api) aluno(personal uuid.UUID) string {
	return a.token(a.seed.Aluno(personal), "ALUNO", personal)
}

func TestCatalog_RotasExigemAutenticacao(t *testing.T) {
	a := novaAPI(t)
	for _, r := range [][2]string{
		{"GET", "/grupos-musculares"}, {"GET", "/exercicios"},
		{"GET", "/exercicios/" + uuid.NewString()},
		{"PATCH", "/exercicios/" + uuid.NewString()},
		{"DELETE", "/exercicios/" + uuid.NewString()},
	} {
		if st, _ := a.do(r[0], r[1], nil, ""); st != 401 {
			t.Errorf("%s %s sem token: %d, quer 401", r[0], r[1], st)
		}
	}
}

func TestCatalog_GruposMusculares_ArrayDiretoOrdenado(t *testing.T) {
	a := novaAPI(t)
	_, tok := a.personal()

	st, raw := a.do("GET", "/grupos-musculares", nil, tok)
	if st != 200 {
		t.Fatalf("status %d: %s", st, raw)
	}
	var grupos []obj
	if err := json.Unmarshal(raw, &grupos); err != nil {
		t.Fatalf("esperava array direto: %s", raw)
	}
	if len(grupos) == 0 {
		t.Fatal("seed das migrations deveria trazer grupos")
	}
	for i := 1; i < len(grupos); i++ {
		if strings.ToLower(grupos[i-1]["nome"].(string)) > strings.ToLower(grupos[i]["nome"].(string)) {
			t.Errorf("grupos fora de ordem: %v antes de %v", grupos[i-1]["nome"], grupos[i]["nome"])
		}
	}
	// ALUNO tambem le.
	p, _ := a.personal()
	if st, _ := a.do("GET", "/grupos-musculares", nil, a.aluno(p)); st != 200 {
		t.Errorf("aluno lendo grupos: %d", st)
	}
}

func TestCatalog_Visibilidade_GlobaisMaisProprios(t *testing.T) {
	a := novaAPI(t)
	p1, tok1 := a.personal()
	p2, tok2 := a.personal()
	a.seed.Exercicio("Global Supino", nil)
	a.seed.Exercicio("Do P1", &p1)
	a.seed.Exercicio("Do P2", &p2)

	_, raw := a.do("GET", "/exercicios", nil, tok1)
	l1 := nomes(t, raw)
	if !tem(l1, "Global Supino") || !tem(l1, "Do P1") || tem(l1, "Do P2") {
		t.Errorf("personal 1 enxerga %v", l1)
	}
	_, raw = a.do("GET", "/exercicios", nil, tok2)
	if l2 := nomes(t, raw); !tem(l2, "Do P2") || tem(l2, "Do P1") {
		t.Errorf("personal 2 enxerga %v", l2)
	}

	// ALUNO usa o tenant (personal vinculado).
	_, raw = a.do("GET", "/exercicios", nil, a.aluno(p1))
	if la := nomes(t, raw); !tem(la, "Do P1") || !tem(la, "Global Supino") || tem(la, "Do P2") {
		t.Errorf("aluno do p1 enxerga %v", la)
	}
}

func TestCatalog_Listar_FiltrosBuscaEGrupo(t *testing.T) {
	a := novaAPI(t)
	p, tok := a.personal()
	a.seed.Exercicio("Kettlebell Swing", &p)
	a.seed.Exercicio("Kettlebell Press", &p)
	a.seed.Exercicio("Zumba Especial", &p)

	_, raw := a.do("GET", "/exercicios?busca=kettlebell", nil, tok)
	if l := nomes(t, raw); len(l) != 2 || !tem(l, "Kettlebell Swing") || !tem(l, "Kettlebell Press") {
		t.Errorf("busca=kettlebell: %v", l)
	}
	// busca e aparada (TrimSpace) e case-insensitive.
	_, raw = a.do("GET", "/exercicios?busca=%20ZUMBA%20", nil, tok)
	if l := nomes(t, raw); len(l) != 1 || l[0] != "Zumba Especial" {
		t.Errorf("busca com espacos: %v", l)
	}

	// grupo valido filtra; grupo sem exercicios devolve lista vazia ([] e nao null).
	vazio := uuid.NewString()
	st, raw := a.do("GET", "/exercicios?grupo_muscular_id="+vazio, nil, tok)
	if st != 200 || !strings.Contains(string(raw), `"data":[]`) {
		t.Errorf("grupo sem exercicios: %d %s", st, raw)
	}
	g := a.seed.Grupo()
	_, raw = a.do("GET", "/exercicios?grupo_muscular_id="+g.String(), nil, tok)
	if l := nomes(t, raw); !tem(l, "Kettlebell Swing") || !tem(l, "Zumba Especial") {
		t.Errorf("filtro pelo grupo do seed: %v", l)
	}

	if st, _ := a.do("GET", "/exercicios?grupo_muscular_id=xyz", nil, tok); st != 400 {
		t.Errorf("grupo invalido: %d, quer 400", st)
	}
}

func TestCatalog_Buscar(t *testing.T) {
	a := novaAPI(t)
	p1, tok1 := a.personal()
	_, tok2 := a.personal()
	global := a.seed.Exercicio("Global", nil)
	priv := a.seed.Exercicio("Privado", &p1)

	st, raw := a.do("GET", "/exercicios/"+global.String(), nil, tok2)
	if st != 200 {
		t.Fatalf("global visivel a qualquer personal: %d %s", st, raw)
	}
	if m := decode(t, raw); m["is_global"] != true || m["grupo_muscular"].(obj)["nome"] == "" {
		t.Errorf("payload global: %v", m)
	}

	if st, _ := a.do("GET", "/exercicios/"+priv.String(), nil, tok1); st != 200 {
		t.Errorf("dono ve o proprio: %d", st)
	}
	// Privado de outro personal e 404 (nao 403: nao vaza existencia).
	if st, _ := a.do("GET", "/exercicios/"+priv.String(), nil, tok2); st != 404 {
		t.Errorf("privado de outro: %d, quer 404", st)
	}
	if st, _ := a.do("GET", "/exercicios/"+uuid.NewString(), nil, tok1); st != 404 {
		t.Errorf("inexistente: %d, quer 404", st)
	}
	if st, _ := a.do("GET", "/exercicios/nao-e-uuid", nil, tok1); st != 400 {
		t.Errorf("id invalido: %d, quer 400", st)
	}
}

func TestCatalog_Criar_SemMidia(t *testing.T) {
	a := novaAPI(t)
	p, tok := a.personal()
	g := a.seed.Grupo()

	st, raw := a.multipartPost(map[string]string{
		"nome": "  Remada Zeta  ", "descricao": " costas ", "grupo_muscular_id": g.String(),
	}, nil, tok)
	if st != 201 {
		t.Fatalf("criar: %d %s", st, raw)
	}
	m := decode(t, raw)
	if m["nome"] != "Remada Zeta" || m["descricao"] != "costas" || m["is_global"] != false {
		t.Errorf("resposta: %v", m)
	}
	if m["midia_url"] != nil || len(a.storage.uploads) != 0 {
		t.Errorf("nao deveria ter midia: %v uploads=%d", m["midia_url"], len(a.storage.uploads))
	}

	// Fica visivel na listagem do dono, mas nao para outro personal.
	_, raw = a.do("GET", "/exercicios", nil, tok)
	if !tem(nomes(t, raw), "Remada Zeta") {
		t.Error("criado nao aparece na listagem")
	}
	_, tokOutro := a.personal()
	_, raw = a.do("GET", "/exercicios", nil, tokOutro)
	if tem(nomes(t, raw), "Remada Zeta") {
		t.Error("exercicio vazou para outro personal")
	}

	var dono uuid.UUID
	if err := a.seed.Pool.QueryRow(a.seed.Ctx, `SELECT personal_id FROM exercicio WHERE id = $1`, m["id"]).Scan(&dono); err != nil || dono != p {
		t.Errorf("dono gravado = %v (%v), quer %v", dono, err, p)
	}
}

func TestCatalog_Criar_ComMidia(t *testing.T) {
	a := novaAPI(t)
	_, tok := a.personal()
	g := a.seed.Grupo().String()

	casos := []struct {
		nome      string
		f         arquivo
		status    int
		tipoMidia string
	}{
		{"png", arquivo{"a.png", "image/png", []byte("x")}, 201, "IMAGEM"},
		{"gif", arquivo{"a.gif", "image/gif", []byte("x")}, 201, "GIF"},
		{"mp4", arquivo{"a.mp4", "video/mp4", bytes.Repeat([]byte("v"), 6<<20)}, 201, "VIDEO"},
		{"pdf nao suportado", arquivo{"a.pdf", "application/pdf", []byte("x")}, 415, ""},
		{"imagem acima de 5MB", arquivo{"a.png", "image/png", bytes.Repeat([]byte("i"), 5<<20+1)}, 413, ""},
		{"acima do teto absoluto 12MB", arquivo{"a.mp4", "video/mp4", bytes.Repeat([]byte("v"), 12<<20+1)}, 413, ""},
		{"arquivo vazio", arquivo{"a.png", "image/png", nil}, 400, ""},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			antes := len(a.storage.uploads)
			st, raw := a.multipartPost(map[string]string{"nome": "Ex " + c.nome, "grupo_muscular_id": g}, &c.f, tok)
			if st != c.status {
				t.Fatalf("status %d, quer %d: %.200s", st, c.status, raw)
			}
			if c.status == 201 {
				m := decode(t, raw)
				if m["tipo_midia"] != c.tipoMidia || !strings.HasPrefix(m["midia_url"].(string), "http://midia.test/") {
					t.Errorf("midia: %v", m)
				}
				if len(a.storage.uploads) != antes+1 {
					t.Error("upload nao chamado")
				}
			} else if len(a.storage.uploads) != antes {
				t.Error("upload nao deveria ter ocorrido em requisicao rejeitada")
			}
		})
	}
}

func TestCatalog_Criar_Validacao(t *testing.T) {
	a := novaAPI(t)
	_, tok := a.personal()
	g := a.seed.Grupo().String()

	casos := []struct {
		nome   string
		campos map[string]string
		status int
	}{
		{"sem nome", map[string]string{"grupo_muscular_id": g}, 422},
		{"nome curto", map[string]string{"nome": "x", "grupo_muscular_id": g}, 422},
		{"nome longo", map[string]string{"nome": strings.Repeat("n", 151), "grupo_muscular_id": g}, 422},
		{"sem grupo", map[string]string{"nome": "Valido"}, 422},
		{"grupo nao uuid", map[string]string{"nome": "Valido", "grupo_muscular_id": "abc"}, 422},
		{"grupo inexistente", map[string]string{"nome": "Valido", "grupo_muscular_id": uuid.NewString()}, 422},
		{"descricao longa", map[string]string{"nome": "Valido", "descricao": strings.Repeat("d", 2001), "grupo_muscular_id": g}, 422},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if st, raw := a.multipartPost(c.campos, nil, tok); st != c.status {
				t.Errorf("status %d, quer %d: %.200s", st, c.status, raw)
			}
		})
	}

	// Corpo que nao e multipart.
	if st, _ := a.do("POST", "/exercicios", `{"nome":"Json"}`, tok); st != 400 {
		t.Errorf("corpo JSON em rota multipart: %d, quer 400", st)
	}
}

func TestCatalog_Escrita_SomentePersonal(t *testing.T) {
	a := novaAPI(t)
	p, _ := a.personal()
	aluno := a.aluno(p)
	g := a.seed.Grupo().String()
	ex := a.seed.Exercicio("Meu", &p)

	if st, _ := a.multipartPost(map[string]string{"nome": "Aluno cria", "grupo_muscular_id": g}, nil, aluno); st != 403 {
		t.Errorf("POST como aluno: %d, quer 403", st)
	}
	if st, _ := a.do("PATCH", "/exercicios/"+ex.String(), obj{"nome": "Hack"}, aluno); st != 403 {
		t.Errorf("PATCH como aluno: %d, quer 403", st)
	}
	if st, _ := a.do("DELETE", "/exercicios/"+ex.String(), nil, aluno); st != 403 {
		t.Errorf("DELETE como aluno: %d, quer 403", st)
	}
	var ativo bool
	_ = a.seed.Pool.QueryRow(a.seed.Ctx, `SELECT ativo FROM exercicio WHERE id=$1`, ex).Scan(&ativo)
	if !ativo {
		t.Error("exercicio foi desativado por um ALUNO")
	}
}

func TestCatalog_Atualizar(t *testing.T) {
	a := novaAPI(t)
	p, tok := a.personal()
	outro, tokOutro := a.personal()
	ex := a.seed.Exercicio("Original", &p)
	exOutro := a.seed.Exercicio("Alheio", &outro)
	global := a.seed.Exercicio("Global", nil)
	_ = tokOutro

	st, raw := a.do("PATCH", "/exercicios/"+ex.String(), obj{"nome": " Novo Nome ", "descricao": "d"}, tok)
	if st != 200 {
		t.Fatalf("patch: %d %s", st, raw)
	}
	if m := decode(t, raw); m["nome"] != "Novo Nome" || m["descricao"] != "d" {
		t.Errorf("resposta: %v", m)
	}

	// Campo omitido nao e alterado.
	_, raw = a.do("PATCH", "/exercicios/"+ex.String(), obj{"descricao": "so desc"}, tok)
	if m := decode(t, raw); m["nome"] != "Novo Nome" || m["descricao"] != "so desc" {
		t.Errorf("patch parcial: %v", m)
	}

	if st, _ := a.do("PATCH", "/exercicios/"+exOutro.String(), obj{"nome": "Roubado"}, tok); st != 403 {
		t.Errorf("exercicio alheio: %d, quer 403", st)
	}
	if st, _ := a.do("PATCH", "/exercicios/"+global.String(), obj{"nome": "Roubado"}, tok); st != 403 {
		t.Errorf("exercicio global: %d, quer 403", st)
	}
	if st, _ := a.do("PATCH", "/exercicios/"+uuid.NewString(), obj{"nome": "Ninguem"}, tok); st != 404 {
		t.Errorf("inexistente: %d, quer 404", st)
	}
	if st, _ := a.do("PATCH", "/exercicios/zzz", obj{"nome": "Ninguem"}, tok); st != 400 {
		t.Errorf("id invalido: %d, quer 400", st)
	}
	if st, _ := a.do("PATCH", "/exercicios/"+ex.String(), obj{"nome": "x"}, tok); st != 422 {
		t.Errorf("nome curto: %d, quer 422", st)
	}
	if st, _ := a.do("PATCH", "/exercicios/"+ex.String(), obj{"grupo_muscular_id": uuid.NewString()}, tok); st != 422 {
		t.Errorf("grupo inexistente: %d, quer 422", st)
	}
	if st, _ := a.do("PATCH", "/exercicios/"+ex.String(), "{nao e json", tok); st != 400 {
		t.Errorf("json quebrado: %d, quer 400", st)
	}

	// Exercicio alheio permanece intacto.
	var nome string
	_ = a.seed.Pool.QueryRow(a.seed.Ctx, `SELECT nome FROM exercicio WHERE id=$1`, exOutro).Scan(&nome)
	if nome != "Alheio" {
		t.Errorf("exercicio alheio alterado: %q", nome)
	}
}

func TestCatalog_Desativar(t *testing.T) {
	a := novaAPI(t)
	p, tok := a.personal()
	outro, _ := a.personal()
	ex := a.seed.Exercicio("Apagar", &p)
	exOutro := a.seed.Exercicio("Alheio", &outro)
	global := a.seed.Exercicio("Global", nil)

	if st, _ := a.do("DELETE", "/exercicios/"+ex.String(), nil, tok); st != 204 {
		t.Fatalf("delete: %d", st)
	}
	// Soft delete: some de listagem e busca, mas a linha continua (historico de treinos referencia).
	_, raw := a.do("GET", "/exercicios", nil, tok)
	if tem(nomes(t, raw), "Apagar") {
		t.Error("desativado ainda listado")
	}
	if st, _ := a.do("GET", "/exercicios/"+ex.String(), nil, tok); st != 404 {
		t.Errorf("buscar desativado: %d, quer 404", st)
	}
	var existe bool
	_ = a.seed.Pool.QueryRow(a.seed.Ctx, `SELECT NOT ativo FROM exercicio WHERE id=$1`, ex).Scan(&existe)
	if !existe {
		t.Error("linha deveria permanecer com ativo=false")
	}

	// Segunda desativacao e idempotente em efeito: 404.
	if st, _ := a.do("DELETE", "/exercicios/"+ex.String(), nil, tok); st != 404 {
		t.Errorf("delete repetido: %d, quer 404", st)
	}
	if st, _ := a.do("DELETE", "/exercicios/"+exOutro.String(), nil, tok); st != 403 {
		t.Errorf("alheio: %d, quer 403", st)
	}
	if st, _ := a.do("DELETE", "/exercicios/"+global.String(), nil, tok); st != 403 {
		t.Errorf("global: %d, quer 403", st)
	}
	if st, _ := a.do("DELETE", "/exercicios/xx", nil, tok); st != 400 {
		t.Errorf("id invalido: %d, quer 400", st)
	}
	// Atualizar um desativado: 404.
	if st, _ := a.do("PATCH", "/exercicios/"+ex.String(), obj{"nome": "Revive"}, tok); st != 404 {
		t.Errorf("patch em desativado: %d, quer 404", st)
	}
}
