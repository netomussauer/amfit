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
	"testing"
	"time"

	"github.com/amfit/api/internal/notification/application"
	"github.com/amfit/api/internal/notification/handlers"
	"github.com/amfit/api/internal/notification/infrastructure"
	"github.com/amfit/api/internal/testsupport/pgtest"
	"github.com/amfit/api/pkg/auth"
	"github.com/amfit/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Pilha real do Notification: handler + service + repositorios no PostgreSQL
// de teste + middleware JWT. Nada e falso.

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
	svc := application.NewNotificationService(repos.Tokens, repos.Notifs)

	app := fiber.New()
	handlers.NewNotificationHandler(svc).RegisterAuthenticated(app, middleware.NewAuthMiddleware(&priv.PublicKey))
	return &api{t: t, app: app, seed: pgtest.NewSeed(t, pool), priv: priv}
}

func (a *api) token(sub uuid.UUID, role string) string {
	tok, err := auth.SignToken(jwt.MapClaims{"sub": sub.String(), "role": role, "tenant_id": sub.String()}, a.priv)
	if err != nil {
		a.t.Fatal(err)
	}
	return tok
}

func (a *api) post(body any, token string) (int, []byte) {
	a.t.Helper()
	var rd io.Reader
	switch b := body.(type) {
	case string:
		rd = strings.NewReader(b)
	default:
		raw, err := json.Marshal(b)
		if err != nil {
			a.t.Fatal(err)
		}
		rd = bytes.NewReader(raw)
	}
	req := httptest.NewRequest("POST", "/push-token", rd)
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

type linha struct {
	ownerID    uuid.UUID
	ownerTipo  string
	plataforma string
	ativo      bool
}

func (a *api) tokens(token string) []linha {
	a.t.Helper()
	rows, err := a.seed.Pool.Query(a.seed.Ctx, `SELECT owner_id, owner_tipo::text, plataforma::text, ativo FROM push_token WHERE token = $1 ORDER BY registrado_em`, token)
	if err != nil {
		a.t.Fatal(err)
	}
	defer rows.Close()
	var out []linha
	for rows.Next() {
		var l linha
		if err := rows.Scan(&l.ownerID, &l.ownerTipo, &l.plataforma, &l.ativo); err != nil {
			a.t.Fatal(err)
		}
		out = append(out, l)
	}
	return out
}

func TestPushToken_ExigeAutenticacao(t *testing.T) {
	a := novaAPI(t)
	if st, _ := a.post(map[string]string{"token": "ExponentPushToken[x]", "plataforma": "IOS"}, ""); st != 401 {
		t.Errorf("sem token: %d, quer 401", st)
	}
}

func TestPushToken_RegistraPorRole(t *testing.T) {
	a := novaAPI(t)
	p := a.seed.Personal()
	al := a.seed.Aluno(p)

	if st, raw := a.post(map[string]string{"token": "ExponentPushToken[p]", "plataforma": "ANDROID"}, a.token(p, "PERSONAL")); st != 204 {
		t.Fatalf("personal: %d %s", st, raw)
	}
	if st, raw := a.post(map[string]string{"token": "ExponentPushToken[a]", "plataforma": "IOS"}, a.token(al, "ALUNO")); st != 204 {
		t.Fatalf("aluno: %d %s", st, raw)
	}

	// owner_id e owner_tipo vem do JWT, nunca do corpo.
	if l := a.tokens("ExponentPushToken[p]"); len(l) != 1 || l[0].ownerID != p || l[0].ownerTipo != "PERSONAL" || l[0].plataforma != "ANDROID" || !l[0].ativo {
		t.Errorf("token do personal: %+v", l)
	}
	if l := a.tokens("ExponentPushToken[a]"); len(l) != 1 || l[0].ownerID != al || l[0].ownerTipo != "ALUNO" || l[0].plataforma != "IOS" {
		t.Errorf("token do aluno: %+v", l)
	}

	// Corpo tentando forcar o dono e ignorado.
	outro := uuid.New()
	a.post(map[string]any{"token": "ExponentPushToken[f]", "plataforma": "IOS", "owner_id": outro.String(), "owner_tipo": "PERSONAL"}, a.token(al, "ALUNO"))
	if l := a.tokens("ExponentPushToken[f]"); len(l) != 1 || l[0].ownerID != al || l[0].ownerTipo != "ALUNO" {
		t.Errorf("dono forcado pelo corpo: %+v", l)
	}
}

func TestPushToken_IdempotenteEReativa(t *testing.T) {
	a := novaAPI(t)
	al := a.seed.Aluno(a.seed.Personal())
	tok := a.token(al, "ALUNO")
	const expo = "ExponentPushToken[dup]"

	for i := 0; i < 3; i++ {
		if st, _ := a.post(map[string]string{"token": expo, "plataforma": "IOS"}, tok); st != 204 {
			t.Fatalf("registro %d: %d", i, st)
		}
	}
	if l := a.tokens(expo); len(l) != 1 {
		t.Fatalf("registros repetidos criaram %d linhas", len(l))
	}

	// Token desativado (ex.: Expo devolveu DeviceNotRegistered) e reativado ao
	// registrar de novo; a plataforma e atualizada.
	a.seed.Exec(`UPDATE push_token SET ativo = FALSE WHERE token = $1`, expo)
	if st, _ := a.post(map[string]string{"token": expo, "plataforma": "ANDROID"}, tok); st != 204 {
		t.Fatalf("re-registro: %d", st)
	}
	if l := a.tokens(expo); len(l) != 1 || !l[0].ativo || l[0].plataforma != "ANDROID" {
		t.Errorf("reativacao: %+v", l)
	}
}

func TestPushToken_Validacao(t *testing.T) {
	a := novaAPI(t)
	tok := a.token(a.seed.Aluno(a.seed.Personal()), "ALUNO")
	casos := []struct {
		nome   string
		corpo  any
		status int
	}{
		{"sem token", map[string]string{"plataforma": "IOS"}, 422},
		{"token vazio", map[string]string{"token": "", "plataforma": "IOS"}, 422},
		{"token so espacos", map[string]string{"token": "   ", "plataforma": "IOS"}, 422},
		{"sem plataforma", map[string]string{"token": "t"}, 422},
		{"plataforma invalida", map[string]string{"token": "t", "plataforma": "WINDOWS"}, 422},
		{"plataforma minuscula", map[string]string{"token": "t", "plataforma": "ios"}, 422},
		{"json quebrado", "{nao", 400},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if st, raw := a.post(c.corpo, tok); st != c.status {
				t.Errorf("status %d, quer %d: %.200s", st, c.status, raw)
			}
		})
	}
	var n int
	_ = a.seed.Pool.QueryRow(a.seed.Ctx, `SELECT COUNT(*) FROM push_token`).Scan(&n)
	if n != 0 {
		t.Errorf("requisicoes invalidas gravaram %d tokens", n)
	}
}

func TestPushToken_RoleDesconhecidaRejeitada(t *testing.T) {
	a := novaAPI(t)
	if st, _ := a.post(map[string]string{"token": "t", "plataforma": "IOS"}, a.token(uuid.New(), "ADMIN")); st != 401 {
		t.Errorf("role ADMIN: %d, quer 401", st)
	}
}

// O mesmo aparelho (token Expo) usado por duas contas em sequencia so pode
// ficar ativo para a ultima; senao a conta anterior continuaria recebendo os
// pushes da nova.
func TestPushToken_MesmoAparelhoEmDuasContas_SoAUltimaRecebe(t *testing.T) {
	a := novaAPI(t)
	p := a.seed.Personal()
	a1, a2 := a.seed.Aluno(p), a.seed.Aluno(p)
	const expo = "ExponentPushToken[aparelho]"
	a.post(map[string]string{"token": expo, "plataforma": "IOS"}, a.token(a1, "ALUNO"))
	a.post(map[string]string{"token": expo, "plataforma": "IOS"}, a.token(a2, "ALUNO"))
	ativos := map[uuid.UUID]bool{}
	for _, l := range a.tokens(expo) {
		ativos[l.ownerID] = l.ativo
	}
	if len(ativos) != 2 || ativos[a1] || !ativos[a2] {
		t.Errorf("ativos por dono: a1=%v a2=%v", ativos[a1], ativos[a2])
	}

	// A primeira conta volta ao aparelho: reativa para ela e desativa a outra.
	a.post(map[string]string{"token": expo, "plataforma": "IOS"}, a.token(a1, "ALUNO"))
	ativos = map[uuid.UUID]bool{}
	for _, l := range a.tokens(expo) {
		ativos[l.ownerID] = l.ativo
	}
	if !ativos[a1] || ativos[a2] {
		t.Errorf("apos a1 voltar: a1=%v a2=%v", ativos[a1], ativos[a2])
	}
}
