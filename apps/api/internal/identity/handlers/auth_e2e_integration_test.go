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

	"github.com/amfit/api/internal/identity/application"
	"github.com/amfit/api/internal/identity/handlers"
	"github.com/amfit/api/internal/identity/infrastructure"
	"github.com/amfit/api/internal/testsupport/pgtest"
	"github.com/amfit/api/pkg/auth"
	"github.com/amfit/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Estes testes sobem a pilha real do Identity — handlers, serviços, repositórios
// no PostgreSQL de teste e o middleware JWT de verdade — e conversam por HTTP.
// Nada é falso: pegam o que testes unitários com repositório em memória não veem
// (SQL, constraints, rotação de refresh token, RBAC por rota).

const senhaPadrao = "SenhaForte123"

type api struct {
	t    *testing.T
	app  *fiber.App
	pool *pgxpool.Pool
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
	svc := application.NewIdentityService(
		repos.Personal, repos.Aluno, repos.Credencial, repos.RefreshTokens, repos.TenantConfig,
		nil, priv, &priv.PublicKey,
	)
	h := handlers.NewIdentityHandler(svc)

	app := fiber.New()
	h.RegisterPublic(app)
	authMW := middleware.NewAuthMiddleware(&priv.PublicKey)
	h.RegisterAuthenticated(app, authMW)
	// Mesma ordem do cmd/server/main.go: as rotas de ALUNO vem antes das de
	// PERSONAL, senao `/alunos/:id` captura `/alunos/me` (Fiber resolve por ordem).
	h.RegisterAlunoRoutes(app, authMW, middleware.RequireRole("ALUNO"))
	h.RegisterPersonalRoutes(app, authMW, middleware.RequireRole("PERSONAL"))

	return &api{t: t, app: app, pool: pool, priv: priv}
}

// do faz a requisição; token vazio = sem Authorization.
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
	// O padrao do Fiber e 1s; register/login/troca de senha fazem bcrypt (custo 10,
	// ate 2x por requisicao) e, com -race, estouram esse limite em maquinas lentas.
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

func (a *api) registrar(nome, email string) application.AuthResponse {
	a.t.Helper()
	status, raw := a.do(http.MethodPost, "/auth/register-personal",
		map[string]string{"nome": nome, "email": email, "senha": senhaPadrao}, "")
	if status != http.StatusCreated {
		a.t.Fatalf("register %s: %d %s", email, status, raw)
	}
	return decode[application.AuthResponse](a.t, raw)
}

func (a *api) login(email, senha, tipo string) (int, []byte) {
	return a.do(http.MethodPost, "/auth/login", map[string]string{"email": email, "senha": senha, "tipo": tipo}, "")
}

func (a *api) loginOK(email, tipo string) application.AuthResponse {
	a.t.Helper()
	status, raw := a.login(email, senhaPadrao, tipo)
	if status != http.StatusOK {
		a.t.Fatalf("login %s/%s: %d %s", email, tipo, status, raw)
	}
	return decode[application.AuthResponse](a.t, raw)
}

func (a *api) criarAluno(personalToken, nome, email string) application.AlunoResponse {
	a.t.Helper()
	status, raw := a.do(http.MethodPost, "/alunos",
		map[string]string{"nome": nome, "email": email, "senha": senhaPadrao}, personalToken)
	if status != http.StatusCreated {
		a.t.Fatalf("criar aluno %s: %d %s", email, status, raw)
	}
	return decode[application.AlunoResponse](a.t, raw)
}

func detail(t *testing.T, raw []byte) string {
	t.Helper()
	return decode[middleware.ProblemDetail](t, raw).Detail
}

// ── Registro ───────────────────────────────────────────────────────────────

func TestRegistro_Sucesso(t *testing.T) {
	a := novaAPI(t)

	status, raw := a.do(http.MethodPost, "/auth/register-personal",
		map[string]string{"nome": "  Ana Souza  ", "email": "Ana@AMFIT.test", "senha": senhaPadrao, "cref": "123456-G/SP"}, "")

	if status != http.StatusCreated {
		t.Fatalf("status = %d (%s)", status, raw)
	}
	resp := decode[application.AuthResponse](t, raw)
	if resp.Usuario.Role != "PERSONAL" || resp.Usuario.Nome != "Ana Souza" || resp.TokenType != "Bearer" ||
		resp.ExpiresIn != 900 || resp.AccessToken == "" || resp.RefreshToken == "" {
		t.Errorf("resposta inesperada: %+v", resp)
	}
	for _, proibido := range []string{"hash", "password", "senha"} {
		if strings.Contains(strings.ToLower(string(raw)), proibido) {
			t.Errorf("a resposta nao pode conter %q: %s", proibido, raw)
		}
	}

	// E-mail foi normalizado (trim + minusculas): o login funciona com a forma canonica.
	if st, _ := a.login("ana@amfit.test", senhaPadrao, "PERSONAL"); st != http.StatusOK {
		t.Errorf("login com e-mail normalizado: %d", st)
	}
	// Persistiu com codigo de convite de 8 caracteres.
	var codigo string
	if err := a.pool.QueryRow(context.Background(), `SELECT codigo FROM personal_trainer WHERE email = 'ana@amfit.test'`).Scan(&codigo); err != nil || len(codigo) != 8 {
		t.Errorf("codigo de convite = %q (err=%v)", codigo, err)
	}
}

func TestRegistro_EmailDuplicadoIgnoraCaixa(t *testing.T) {
	a := novaAPI(t)
	a.registrar("Ana", "ana@amfit.test")

	status, raw := a.do(http.MethodPost, "/auth/register-personal",
		map[string]string{"nome": "Outra", "email": "ANA@amfit.test", "senha": senhaPadrao}, "")

	if status != http.StatusConflict || detail(t, raw) != "email já cadastrado" {
		t.Errorf("status=%d body=%s", status, raw)
	}
}

func TestRegistro_Validacao(t *testing.T) {
	a := novaAPI(t)

	status, raw := a.do(http.MethodPost, "/auth/register-personal",
		map[string]string{"nome": "A", "email": "nao-e-email", "senha": "123"}, "")
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d", status)
	}
	campos := map[string]bool{}
	for _, fe := range decode[middleware.ProblemDetail](t, raw).Errors {
		campos[fe.Field] = true
	}
	for _, c := range []string{"nome", "email", "senha"} {
		if !campos[c] {
			t.Errorf("faltou erro para %q: %v", c, campos)
		}
	}

	if status, _ := a.do(http.MethodPost, "/auth/register-personal", "{nao e json", ""); status != http.StatusBadRequest {
		t.Errorf("JSON invalido: %d, want 400", status)
	}
}

// ── Login ──────────────────────────────────────────────────────────────────

func TestLogin_TokenTemOsClaimsCertos(t *testing.T) {
	a := novaAPI(t)
	reg := a.registrar("Ana", "ana@amfit.test")

	login := a.loginOK("ana@amfit.test", "PERSONAL")

	claims, err := auth.VerifyToken(login.AccessToken, &a.priv.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	if claims["sub"] != reg.Usuario.ID || claims["tenant_id"] != reg.Usuario.ID || claims["role"] != "PERSONAL" || claims["name"] != "Ana" {
		t.Errorf("claims inesperados: %v", claims)
	}
	if exp, iat := claims["exp"].(float64), claims["iat"].(float64); time.Duration(exp-iat)*time.Second != 15*time.Minute {
		t.Errorf("access token deveria valer 15 min, vale %v", time.Duration(exp-iat)*time.Second)
	}

	var ultimo *time.Time
	if err := a.pool.QueryRow(context.Background(), `SELECT ultimo_acesso FROM credencial WHERE owner_id = $1`, reg.Usuario.ID).Scan(&ultimo); err != nil || ultimo == nil {
		t.Errorf("login deveria registrar ultimo_acesso (err=%v)", err)
	}
}

func TestLogin_FalhasSaoIndistinguiveis(t *testing.T) {
	a := novaAPI(t)
	a.registrar("Ana", "ana@amfit.test")

	senhaErrada, bErrada := a.login("ana@amfit.test", "SenhaErrada999", "PERSONAL")
	emailInexistente, bInexistente := a.login("ninguem@amfit.test", senhaPadrao, "PERSONAL")
	tipoErrado, bTipo := a.login("ana@amfit.test", senhaPadrao, "ALUNO") // e-mail de personal tentando entrar como aluno

	for nome, st := range map[string]int{"senha errada": senhaErrada, "e-mail inexistente": emailInexistente, "tipo errado": tipoErrado} {
		if st != http.StatusUnauthorized {
			t.Errorf("%s: status %d, want 401", nome, st)
		}
	}
	if !bytes.Equal(bErrada, bInexistente) || !bytes.Equal(bErrada, bTipo) {
		t.Errorf("respostas diferentes permitem enumerar contas:\n%s\n%s\n%s", bErrada, bInexistente, bTipo)
	}
}

func TestLogin_AceitaEmailEmQualquerCaixa_RejeitaTipoInvalido(t *testing.T) {
	a := novaAPI(t)
	a.registrar("Ana", "ana@amfit.test")

	if st, _ := a.login("ANA@Amfit.TEST", senhaPadrao, "PERSONAL"); st != http.StatusOK {
		t.Errorf("e-mail em outra caixa: %d", st)
	}
	if st, _ := a.login("ana@amfit.test", senhaPadrao, "ADMIN"); st != http.StatusUnprocessableEntity {
		t.Errorf("tipo fora de PERSONAL/ALUNO: %d, want 422", st)
	}
	if st, _ := a.login("ana@amfit.test", "curta", "PERSONAL"); st != http.StatusUnprocessableEntity {
		t.Errorf("senha curta: %d, want 422", st)
	}
}

// ── Autorização por rota ───────────────────────────────────────────────────

func TestAcesso_MiddlewareERolesNasRotas(t *testing.T) {
	a := novaAPI(t)
	personal := a.registrar("Ana", "ana@amfit.test")
	a.criarAluno(personal.AccessToken, "Bia", "bia@amfit.test")
	aluno := a.loginOK("bia@amfit.test", "ALUNO")

	// outra chave: token valido em formato, mas nao assinado por este servidor.
	outra, _ := rsa.GenerateKey(rand.Reader, 2048)
	deOutraChave, _ := auth.SignToken(jwt.MapClaims{"sub": personal.Usuario.ID, "role": "PERSONAL", "tenant_id": personal.Usuario.ID}, outra)
	expirado, _ := auth.SignRefreshToken(jwt.MapClaims{"sub": personal.Usuario.ID, "role": "PERSONAL", "tenant_id": personal.Usuario.ID}, a.priv, -time.Minute)

	casos := []struct {
		nome   string
		method string
		path   string
		token  string
		want   int
	}{
		{"personal em rota de personal", "GET", "/personal/me", personal.AccessToken, 200},
		{"aluno em rota de aluno", "GET", "/alunos/me", aluno.AccessToken, 200},
		{"sem token", "GET", "/personal/me", "", 401},
		{"token lixo", "GET", "/personal/me", "isso.nao.e.jwt", 401},
		{"assinado por outra chave", "GET", "/personal/me", deOutraChave, 401},
		{"expirado", "GET", "/personal/me", expirado, 401},
		{"aluno em rota de personal", "GET", "/personal/me", aluno.AccessToken, 403},
		{"aluno listando alunos", "GET", "/alunos", aluno.AccessToken, 403},
		{"personal em rota de aluno", "GET", "/alunos/me", personal.AccessToken, 403},
		{"rota autenticada sem token", "GET", "/tenants/me/config", "", 401},
		{"rota de qualquer role (aluno)", "GET", "/tenants/me/config", aluno.AccessToken, 200},
		{"rota de qualquer role (personal)", "GET", "/tenants/me/config", personal.AccessToken, 200},
	}
	for _, c := range casos {
		if st, raw := a.do(c.method, c.path, nil, c.token); st != c.want {
			t.Errorf("%s: %s %s => %d, want %d (%s)", c.nome, c.method, c.path, st, c.want, raw)
		}
	}
}

// ── Refresh / Logout ───────────────────────────────────────────────────────

func (a *api) refresh(token string) (int, []byte) {
	return a.do(http.MethodPost, "/auth/refresh", map[string]string{"refresh_token": token}, "")
}

func TestRefresh_RotacaoInvalidaOTokenAntigo(t *testing.T) {
	a := novaAPI(t)
	reg := a.registrar("Ana", "ana@amfit.test")

	st, raw := a.refresh(reg.RefreshToken)
	if st != http.StatusOK {
		t.Fatalf("primeiro refresh: %d %s", st, raw)
	}
	novo := decode[application.AuthResponse](t, raw)
	if novo.RefreshToken == reg.RefreshToken || novo.AccessToken == reg.AccessToken {
		t.Error("o refresh deveria emitir um par novo")
	}
	if novo.Usuario.ID != reg.Usuario.ID || novo.Usuario.Role != "PERSONAL" || novo.Usuario.Nome != "Ana" {
		t.Errorf("identidade deveria ser preservada: %+v", novo.Usuario)
	}
	if st, _ := a.do(http.MethodGet, "/personal/me", nil, novo.AccessToken); st != http.StatusOK {
		t.Errorf("access token novo deveria funcionar: %d", st)
	}

	// Reuso do refresh antigo: rejeitado.
	if st, _ := a.refresh(reg.RefreshToken); st != http.StatusUnauthorized {
		t.Errorf("reuso do refresh antigo: %d, want 401", st)
	}
	// O novo funciona uma vez (e a cadeia continua).
	if st, _ := a.refresh(novo.RefreshToken); st != http.StatusOK {
		t.Errorf("refresh encadeado: %d, want 200", st)
	}
}

func TestRefresh_EntradasInvalidas(t *testing.T) {
	a := novaAPI(t)
	reg := a.registrar("Ana", "ana@amfit.test")

	if st, _ := a.refresh(reg.AccessToken); st != http.StatusUnauthorized {
		t.Errorf("access token usado como refresh: %d, want 401", st)
	}
	if st, _ := a.refresh("lixo"); st != http.StatusUnauthorized {
		t.Errorf("token lixo: %d, want 401", st)
	}
	if st, _ := a.do(http.MethodPost, "/auth/refresh", map[string]string{}, ""); st != http.StatusUnprocessableEntity {
		t.Errorf("sem refresh_token: %d, want 422", st)
	}
}

func TestLogout_RevogaORefreshToken(t *testing.T) {
	a := novaAPI(t)
	reg := a.registrar("Ana", "ana@amfit.test")

	if st, _ := a.do(http.MethodPost, "/auth/logout", map[string]string{"refresh_token": reg.RefreshToken}, reg.AccessToken); st != http.StatusNoContent {
		t.Fatalf("logout: %d, want 204", st)
	}
	if st, _ := a.refresh(reg.RefreshToken); st != http.StatusUnauthorized {
		t.Errorf("refresh apos logout: %d, want 401", st)
	}
	// Idempotente: logout com token invalido tambem e 204 (nao vaza nada).
	if st, _ := a.do(http.MethodPost, "/auth/logout", map[string]string{"refresh_token": "lixo"}, reg.AccessToken); st != http.StatusNoContent {
		t.Errorf("logout com token invalido: %d, want 204", st)
	}
	if st, _ := a.do(http.MethodPost, "/auth/logout", map[string]string{"refresh_token": reg.RefreshToken}, ""); st != http.StatusUnauthorized {
		t.Errorf("logout sem autenticacao: %d, want 401", st)
	}
	if st, _ := a.do(http.MethodPost, "/auth/logout", map[string]string{}, reg.AccessToken); st != http.StatusUnprocessableEntity {
		t.Errorf("logout sem refresh_token: %d, want 422", st)
	}
}

func TestSenha_TrocaRevogaSessoesAnteriores(t *testing.T) {
	a := novaAPI(t)
	reg := a.registrar("Ana", "ana@amfit.test")

	st, raw := a.do(http.MethodPatch, "/personal/me/senha",
		map[string]string{"senha_atual": "SenhaErrada999", "nova_senha": "NovaSenha456"}, reg.AccessToken)
	if st != http.StatusUnprocessableEntity || detail(t, raw) != "senha atual incorreta" {
		t.Fatalf("senha atual errada: %d %s", st, raw)
	}

	if st, raw := a.do(http.MethodPatch, "/personal/me/senha",
		map[string]string{"senha_atual": senhaPadrao, "nova_senha": "NovaSenha456"}, reg.AccessToken); st != http.StatusNoContent {
		t.Fatalf("troca de senha: %d %s", st, raw)
	}

	if st, _ := a.login("ana@amfit.test", senhaPadrao, "PERSONAL"); st != http.StatusUnauthorized {
		t.Errorf("senha antiga ainda funciona: %d", st)
	}
	if st, _ := a.login("ana@amfit.test", "NovaSenha456", "PERSONAL"); st != http.StatusOK {
		t.Errorf("senha nova nao funciona: %d", st)
	}
	if st, _ := a.refresh(reg.RefreshToken); st != http.StatusUnauthorized {
		t.Errorf("refresh anterior a troca de senha deveria estar revogado: %d", st)
	}
}

// ── Alunos: ciclo de vida e isolamento entre personals ─────────────────────

func TestAlunos_CicloDeVidaEIsolamento(t *testing.T) {
	a := novaAPI(t)
	ana := a.registrar("Ana", "ana@amfit.test")
	beto := a.registrar("Beto", "beto@amfit.test")

	bia := a.criarAluno(ana.AccessToken, "Bia", "bia@amfit.test")
	a.criarAluno(ana.AccessToken, "Caio", "caio@amfit.test")
	if !bia.Ativo || bia.Email != "bia@amfit.test" {
		t.Errorf("aluno criado: %+v", bia)
	}

	t.Run("e-mail de aluno e unico no sistema, inclusive entre personals", func(t *testing.T) {
		st, _ := a.do(http.MethodPost, "/alunos",
			map[string]string{"nome": "Dup", "email": "bia@amfit.test", "senha": senhaPadrao}, beto.AccessToken)
		if st != http.StatusConflict {
			t.Errorf("status = %d, want 409", st)
		}
	})

	t.Run("o aluno entra e enxerga o proprio perfil, com o personal como tenant", func(t *testing.T) {
		login := a.loginOK("bia@amfit.test", "ALUNO")
		claims, _ := auth.VerifyToken(login.AccessToken, &a.priv.PublicKey)
		if claims["role"] != "ALUNO" || claims["tenant_id"] != ana.Usuario.ID || claims["sub"] != bia.ID {
			t.Errorf("claims do aluno: %v", claims)
		}
		st, raw := a.do(http.MethodGet, "/alunos/me", nil, login.AccessToken)
		if st != http.StatusOK || decode[application.AlunoResponse](t, raw).ID != bia.ID {
			t.Errorf("/alunos/me: %d %s", st, raw)
		}
	})

	t.Run("outro personal nao ve, edita nem desativa (404)", func(t *testing.T) {
		for _, c := range []struct{ method, body string }{{"GET", ""}, {"PATCH", `{"nome":"Hackeado"}`}, {"DELETE", ""}} {
			var body any
			if c.body != "" {
				body = c.body
			}
			if st, _ := a.do(c.method, "/alunos/"+bia.ID, body, beto.AccessToken); st != http.StatusNotFound {
				t.Errorf("%s por outro personal: %d, want 404", c.method, st)
			}
		}
		_, raw := a.do(http.MethodGet, "/alunos/"+bia.ID, nil, ana.AccessToken)
		if decode[application.AlunoResponse](t, raw).Nome != "Bia" {
			t.Error("o aluno foi alterado por outro personal")
		}
	})

	t.Run("lista so os proprios, com busca e paginacao", func(t *testing.T) {
		_, raw := a.do(http.MethodGet, "/alunos", nil, ana.AccessToken)
		if l := decode[application.AlunoListResponse](t, raw); l.Pagination.Total != 2 || len(l.Data) != 2 {
			t.Errorf("lista da Ana: %+v", l.Pagination)
		}
		_, raw = a.do(http.MethodGet, "/alunos", nil, beto.AccessToken)
		if l := decode[application.AlunoListResponse](t, raw); l.Pagination.Total != 0 {
			t.Errorf("Beto nao tem alunos: %+v", l.Pagination)
		}
		_, raw = a.do(http.MethodGet, "/alunos?busca=cai", nil, ana.AccessToken)
		if l := decode[application.AlunoListResponse](t, raw); len(l.Data) != 1 || l.Data[0].Nome != "Caio" {
			t.Errorf("busca: %+v", l.Data)
		}
		_, raw = a.do(http.MethodGet, "/alunos?per_page=1&page=2", nil, ana.AccessToken)
		if l := decode[application.AlunoListResponse](t, raw); len(l.Data) != 1 || l.Pagination.Total != 2 {
			t.Errorf("paginacao: %+v", l)
		}
	})

	t.Run("entradas invalidas", func(t *testing.T) {
		if st, _ := a.do(http.MethodGet, "/alunos/nao-e-uuid", nil, ana.AccessToken); st != http.StatusBadRequest {
			t.Errorf("id invalido: %d", st)
		}
		if st, _ := a.do(http.MethodGet, "/alunos?ativo=talvez", nil, ana.AccessToken); st != http.StatusBadRequest {
			t.Errorf("ativo invalido: %d", st)
		}
		if st, _ := a.do(http.MethodPost, "/alunos", map[string]string{"nome": "X", "email": "x@x.test", "senha": senhaPadrao, "sexo": "Z"}, ana.AccessToken); st != http.StatusUnprocessableEntity {
			t.Errorf("sexo invalido: %d", st)
		}
	})

	t.Run("desativar tira da listagem de ativos", func(t *testing.T) {
		if st, _ := a.do(http.MethodDelete, "/alunos/"+bia.ID, nil, ana.AccessToken); st != http.StatusNoContent {
			t.Fatalf("desativar: %d", st)
		}
		_, raw := a.do(http.MethodGet, "/alunos?ativo=true", nil, ana.AccessToken)
		if l := decode[application.AlunoListResponse](t, raw); l.Pagination.Total != 1 {
			t.Errorf("ativos: %+v", l.Pagination)
		}
		_, raw = a.do(http.MethodGet, "/alunos?ativo=false", nil, ana.AccessToken)
		if l := decode[application.AlunoListResponse](t, raw); l.Pagination.Total != 1 || l.Data[0].ID != bia.ID {
			t.Errorf("inativos: %+v", l.Pagination)
		}
	})
}

// ── Branding publico por codigo de convite ─────────────────────────────────

func TestTenantPublico_CodigoDeConvite(t *testing.T) {
	a := novaAPI(t)
	ana := a.registrar("Ana", "ana@amfit.test")

	_, raw := a.do(http.MethodGet, "/tenants/me/config", nil, ana.AccessToken)
	codigo := decode[application.TenantConfigResponse](t, raw).Codigo
	if len(codigo) != 8 {
		t.Fatalf("o personal deveria ver o proprio codigo: %q", codigo)
	}

	t.Run("codigo valido devolve o branding sem exigir login e sem repetir o codigo", func(t *testing.T) {
		st, raw := a.do(http.MethodGet, "/public/tenants/"+codigo+"/config", nil, "")
		if st != http.StatusOK {
			t.Fatalf("status = %d (%s)", st, raw)
		}
		cfg := decode[application.TenantConfigResponse](t, raw)
		if cfg.CorPrimaria == "" || cfg.CorSecundaria == "" || cfg.Codigo != "" {
			t.Errorf("config publica: %+v", cfg)
		}
	})

	t.Run("inexistente e malformado dao a mesma resposta (anti-enumeracao)", func(t *testing.T) {
		s1, b1 := a.do(http.MethodGet, "/public/tenants/ZZZZZZZZ/config", nil, "") // formato valido, nao existe
		s2, b2 := a.do(http.MethodGet, "/public/tenants/abc/config", nil, "")      // malformado
		if s1 != http.StatusNotFound || s2 != http.StatusNotFound || !bytes.Equal(b1, b2) {
			t.Errorf("%d %s | %d %s", s1, b1, s2, b2)
		}
	})

	t.Run("regenerar invalida o codigo antigo", func(t *testing.T) {
		st, raw := a.do(http.MethodPost, "/tenants/me/codigo/regenerar", nil, ana.AccessToken)
		novo := decode[application.TenantConfigResponse](t, raw).Codigo
		if st != http.StatusOK || novo == "" || novo == codigo {
			t.Fatalf("regenerar: %d novo=%q antigo=%q", st, novo, codigo)
		}
		if st, _ := a.do(http.MethodGet, "/public/tenants/"+codigo+"/config", nil, ""); st != http.StatusNotFound {
			t.Errorf("codigo antigo: %d, want 404", st)
		}
		if st, _ := a.do(http.MethodGet, "/public/tenants/"+novo+"/config", nil, ""); st != http.StatusOK {
			t.Errorf("codigo novo: %d, want 200", st)
		}
	})

	t.Run("aluno nao recebe o codigo de convite do personal", func(t *testing.T) {
		a.criarAluno(ana.AccessToken, "Bia", "bia@amfit.test")
		aluno := a.loginOK("bia@amfit.test", "ALUNO")
		_, raw := a.do(http.MethodGet, "/tenants/me/config", nil, aluno.AccessToken)
		if decode[application.TenantConfigResponse](t, raw).Codigo != "" {
			t.Errorf("o aluno nao deveria ver o codigo: %s", raw)
		}
	})
}

func TestTenantPublico_LimiteDeRequisicoesPorIP(t *testing.T) {
	a := novaAPI(t)

	var primeiro429 int
	for i := 1; i <= 125; i++ {
		st, _ := a.do(http.MethodGet, "/public/tenants/ZZZZZZZZ/config", nil, "")
		if st == http.StatusTooManyRequests && primeiro429 == 0 {
			primeiro429 = i
		}
	}
	if primeiro429 != 121 {
		t.Errorf("o limite e 120/min: a primeira resposta 429 deveria ser a requisicao 121, foi a %d", primeiro429)
	}
}

// ── Seguranca: tipo de token e contas desativadas ──────────────────────────
// Cada teste afirma o comportamento SEGURO; falharam antes das correcoes
// (refresh token abria rotas autenticadas; contas desativadas continuavam
// entrando e renovando a sessao).

func TestSeguranca_RefreshTokenNaoValeComoAccessToken(t *testing.T) {
	a := novaAPI(t)
	reg := a.registrar("Ana", "ana@amfit.test")

	if st, raw := a.do(http.MethodGet, "/personal/me", nil, reg.RefreshToken); st != http.StatusUnauthorized {
		t.Errorf("refresh token aceito como access token: %d (%.80s)", st, raw)
	}
	// O access token legitimo continua funcionando.
	if st, _ := a.do(http.MethodGet, "/personal/me", nil, reg.AccessToken); st != http.StatusOK {
		t.Errorf("access token: %d, want 200", st)
	}
}

func TestSeguranca_LogoutNaoDeixaORefreshTokenAbrirRotas(t *testing.T) {
	a := novaAPI(t)
	reg := a.registrar("Ana", "ana@amfit.test")
	a.do(http.MethodPost, "/auth/logout", map[string]string{"refresh_token": reg.RefreshToken}, reg.AccessToken)

	if st, _ := a.do(http.MethodGet, "/personal/me", nil, reg.RefreshToken); st != http.StatusUnauthorized {
		t.Errorf("refresh token revogado ainda abre rotas autenticadas: %d", st)
	}
}

func TestSeguranca_AlunoDesativadoNaoEntraNemRenovaASessao(t *testing.T) {
	a := novaAPI(t)
	ana := a.registrar("Ana", "ana@amfit.test")
	bia := a.criarAluno(ana.AccessToken, "Bia", "bia@amfit.test")
	sessao := a.loginOK("bia@amfit.test", "ALUNO")

	if st, _ := a.do(http.MethodDelete, "/alunos/"+bia.ID, nil, ana.AccessToken); st != http.StatusNoContent {
		t.Fatalf("desativar: %d", st)
	}

	st, raw := a.login("bia@amfit.test", senhaPadrao, "ALUNO")
	if st != http.StatusUnauthorized {
		t.Errorf("login de aluno desativado: %d, want 401", st)
	}
	// Mesma resposta de uma credencial invalida: nao revela que a conta existe/foi desativada.
	_, esperado := a.login("bia@amfit.test", "SenhaErrada999", "ALUNO")
	if !bytes.Equal(raw, esperado) {
		t.Errorf("resposta distinta de credencial invalida:\n%s\n%s", raw, esperado)
	}
	if st, _ := a.refresh(sessao.RefreshToken); st != http.StatusUnauthorized {
		t.Errorf("refresh de aluno desativado: %d, want 401", st)
	}
}

func TestSeguranca_PersonalDesativadoNaoEntraNemRenova(t *testing.T) {
	a := novaAPI(t)
	reg := a.registrar("Ana", "ana@amfit.test")
	if _, err := a.pool.Exec(context.Background(), `UPDATE personal_trainer SET ativo = FALSE WHERE email = 'ana@amfit.test'`); err != nil {
		t.Fatal(err)
	}

	if st, _ := a.login("ana@amfit.test", senhaPadrao, "PERSONAL"); st != http.StatusUnauthorized {
		t.Errorf("login de personal desativado: %d, want 401", st)
	}
	if st, _ := a.refresh(reg.RefreshToken); st != http.StatusUnauthorized {
		t.Errorf("refresh de personal desativado: %d, want 401", st)
	}
}
