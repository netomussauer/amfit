package middleware

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/amfit/api/pkg/auth"
	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
)

func chaveTeste(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	k, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("gerar chave: %v", err)
	}
	return k
}

// appAutenticado monta uma rota protegida que devolve os valores injetados no contexto.
func appAutenticado(pub *rsa.PublicKey, extra ...fiber.Handler) *fiber.App {
	app := fiber.New()
	mws := append([]fiber.Handler{NewAuthMiddleware(pub)}, extra...)
	Get(app, "/p", mws, func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"user_id":   c.Locals("user_id"),
			"role":      c.Locals("role"),
			"tenant_id": c.Locals("tenant_id"),
		})
	})
	return app
}

func chamar(t *testing.T, app *fiber.App, authz string) (int, []byte) {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/p", nil)
	if authz != "" {
		req.Header.Set("Authorization", authz)
	}
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()
	var buf [4096]byte
	n, _ := resp.Body.Read(buf[:])
	return resp.StatusCode, buf[:n]
}

func TestAuthMiddleware_TokenValido_InjetaClaimsNoContexto(t *testing.T) {
	priv := chaveTeste(t)
	tok, err := auth.SignToken(jwt.MapClaims{"sub": "u1", "role": "ALUNO", "tenant_id": "t1"}, priv)
	if err != nil {
		t.Fatal(err)
	}

	status, body := chamar(t, appAutenticado(&priv.PublicKey), "Bearer "+tok)
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200 (%s)", status, body)
	}
	var got map[string]string
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatalf("resposta invalida: %v", err)
	}
	if got["user_id"] != "u1" || got["role"] != "ALUNO" || got["tenant_id"] != "t1" {
		t.Errorf("locals inesperados: %v", got)
	}
}

func TestAuthMiddleware_Rejeita401(t *testing.T) {
	priv := chaveTeste(t)
	outra := chaveTeste(t)
	validoOutraChave, _ := auth.SignToken(jwt.MapClaims{"sub": "u1"}, outra)
	expirado, _ := auth.SignRefreshToken(jwt.MapClaims{"sub": "u1"}, priv, -time.Minute)

	casos := map[string]string{
		"sem header":         "",
		"esquema Basic":      "Basic abc",
		"Bearer sem espaco":  "Bearer",
		"token lixo":         "Bearer lixo",
		"assinado por outra": "Bearer " + validoOutraChave,
		"expirado":           "Bearer " + expirado,
	}
	for nome, h := range casos {
		t.Run(nome, func(t *testing.T) {
			status, body := chamar(t, appAutenticado(&priv.PublicKey), h)
			if status != http.StatusUnauthorized {
				t.Fatalf("status = %d, want 401", status)
			}
			var p ProblemDetail
			if err := json.Unmarshal(body, &p); err != nil {
				t.Fatalf("corpo nao e Problem Details: %v", err)
			}
			if p.Status != 401 || p.Type != problemTypeBase+"unauthorized" {
				t.Errorf("problem inesperado: %+v", p)
			}
		})
	}
}

func TestRequireRole(t *testing.T) {
	priv := chaveTeste(t)
	app := appAutenticado(&priv.PublicKey, RequireRole("PERSONAL"))

	personal, _ := auth.SignToken(jwt.MapClaims{"sub": "u1", "role": "PERSONAL"}, priv)
	aluno, _ := auth.SignToken(jwt.MapClaims{"sub": "u2", "role": "ALUNO"}, priv)
	semRole, _ := auth.SignToken(jwt.MapClaims{"sub": "u3"}, priv)

	casos := []struct {
		nome   string
		token  string
		status int
	}{
		{"role exigido passa", personal, http.StatusOK},
		{"outro role e barrado", aluno, http.StatusForbidden},
		{"sem claim role e barrado", semRole, http.StatusForbidden},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if status, _ := chamar(t, app, "Bearer "+c.token); status != c.status {
				t.Errorf("status = %d, want %d", status, c.status)
			}
		})
	}
}
