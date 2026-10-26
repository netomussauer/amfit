package middleware

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
)

func TestNewProblem_MontaTypeComBase(t *testing.T) {
	p := NewProblem(404, "not-found", "Not Found", "nada aqui")
	if p.Type != "https://amfit.local/errors/not-found" || p.Status != 404 ||
		p.Title != "Not Found" || p.Detail != "nada aqui" {
		t.Errorf("problem inesperado: %+v", p)
	}
}

func TestWriteProblem_UsaStatusDoProblemEOmiteErrorsVazio(t *testing.T) {
	app := fiber.New()
	app.Get("/", func(c fiber.Ctx) error {
		return WriteProblem(c, NewProblem(422, "validation", "Invalid", "campo invalido"))
	})

	resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 422 {
		t.Errorf("status = %d, want 422", resp.StatusCode)
	}
	raw, _ := io.ReadAll(resp.Body)
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatalf("json invalido: %v", err)
	}
	if _, ok := m["errors"]; ok {
		t.Error("campo errors deveria ser omitido quando vazio")
	}
}

func TestRecovery_PanicViraProblem500(t *testing.T) {
	app := fiber.New()
	Get(app, "/boom", []fiber.Handler{Recovery()}, func(c fiber.Ctx) error {
		panic("kaboom")
	})

	resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/boom", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", resp.StatusCode)
	}
	var p ProblemDetail
	raw, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(raw, &p); err != nil || p.Type != problemTypeBase+"internal" {
		t.Errorf("corpo inesperado: %s (err=%v)", raw, err)
	}
}

func TestChain_MiddlewaresRodamAntesDoHandlerNaOrdem(t *testing.T) {
	var ordem []string
	marca := func(n string) fiber.Handler {
		return func(c fiber.Ctx) error { ordem = append(ordem, n); return c.Next() }
	}
	app := fiber.New()
	Post(app, "/x", []fiber.Handler{marca("m1"), marca("m2")}, func(c fiber.Ctx) error {
		ordem = append(ordem, "h")
		return c.SendStatus(http.StatusNoContent)
	})

	resp, err := app.Test(httptest.NewRequest(http.MethodPost, "/x", nil))
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if got := ordem; len(got) != 3 || got[0] != "m1" || got[1] != "m2" || got[2] != "h" {
		t.Errorf("ordem = %v, want [m1 m2 h]", got)
	}
}

func TestChain_VerbosRegistramNoMetodoCerto(t *testing.T) {
	app := fiber.New()
	h := func(c fiber.Ctx) error { return c.SendStatus(http.StatusNoContent) }
	Get(app, "/r", nil, h)
	Patch(app, "/r", nil, h)
	Delete(app, "/r", nil, h)

	for _, m := range []string{http.MethodGet, http.MethodPatch, http.MethodDelete} {
		resp, err := app.Test(httptest.NewRequest(m, "/r", nil))
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		if resp.StatusCode != http.StatusNoContent {
			t.Errorf("%s /r = %d, want 204", m, resp.StatusCode)
		}
	}
	resp, _ := app.Test(httptest.NewRequest(http.MethodPost, "/r", nil))
	resp.Body.Close()
	if resp.StatusCode != http.StatusMethodNotAllowed && resp.StatusCode != http.StatusNotFound {
		t.Errorf("POST nao registrado = %d, want 404/405", resp.StatusCode)
	}
}

func TestRateLimitByIP_BloqueiaAposOLimiteChamandoOHandler(t *testing.T) {
	app := fiber.New()
	limitado := func(c fiber.Ctx) error {
		return WriteProblem(c, NewProblem(http.StatusTooManyRequests, "rate-limited", "Too Many Requests", "calma"))
	}
	Get(app, "/pub", []fiber.Handler{RateLimitByIP(2, time.Minute, limitado)},
		func(c fiber.Ctx) error { return c.SendStatus(http.StatusOK) })

	want := []int{200, 200, 429, 429}
	for i, w := range want {
		resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/pub", nil))
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		if resp.StatusCode != w {
			t.Errorf("req %d: status = %d, want %d", i+1, resp.StatusCode, w)
		}
	}
}
