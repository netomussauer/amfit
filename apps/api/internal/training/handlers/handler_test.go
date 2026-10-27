package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/amfit/api/internal/training/application"
	"github.com/amfit/api/internal/training/domain"
	"github.com/amfit/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// ── Fakes ──────────────────────────────────────────────────────────────────
// Cada fake embute a interface do repositório: só os métodos usados pelos
// testes são implementados (chamar outro deles panica com nil, o que
// denuncia uma dependência inesperada do handler).

type fakeFichas struct {
	domain.FichaRepository
	porID       map[uuid.UUID]*domain.FichaTreino
	criadas     []*domain.FichaTreino
	desativadas []uuid.UUID
	filtro      domain.ListFichasFilter
	createErr   error
}

func (f *fakeFichas) Create(_ context.Context, fi *domain.FichaTreino) error {
	if f.createErr != nil {
		return f.createErr
	}
	f.criadas = append(f.criadas, fi)
	return nil
}

func (f *fakeFichas) FindByID(_ context.Context, id uuid.UUID) (*domain.FichaTreino, error) {
	fi, ok := f.porID[id]
	if !ok {
		return nil, domain.ErrFichaNotFound
	}
	cp := *fi
	return &cp, nil
}

func (f *fakeFichas) List(_ context.Context, filtro domain.ListFichasFilter) ([]*domain.FichaTreino, error) {
	f.filtro = filtro
	return nil, nil
}

func (f *fakeFichas) Deactivate(_ context.Context, id uuid.UUID) error {
	f.desativadas = append(f.desativadas, id)
	return nil
}

type fakeTreinos struct {
	domain.TreinoRepository
	criados   []*domain.Treino
	createErr error
}

func (f *fakeTreinos) Create(_ context.Context, t *domain.Treino) error {
	if f.createErr != nil {
		return f.createErr
	}
	f.criados = append(f.criados, t)
	return nil
}

type fakeLeitura struct {
	domain.FichaCompletaRepository
}

func (fakeLeitura) GetCompleta(_ context.Context, id uuid.UUID) (*domain.FichaCompleta, error) {
	return &domain.FichaCompleta{
		Ficha: domain.FichaTreino{ID: id, Nome: "Hipertrofia", Ativa: true, VigenciaInicio: time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)},
	}, nil
}

type fakeAlunos struct{ pertence bool }

func (f fakeAlunos) BelongsToPersonal(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return f.pertence, nil
}

// ── Harness ────────────────────────────────────────────────────────────────

type env struct {
	app     *fiber.App
	fichas  *fakeFichas
	treinos *fakeTreinos
	alunos  *fakeAlunos
	// sub é o valor injetado em Locals("user_id"); vazio simula token sem sub valido.
	sub string
}

func novoEnv(t *testing.T, personalID uuid.UUID) *env {
	t.Helper()
	e := &env{
		fichas:  &fakeFichas{porID: map[uuid.UUID]*domain.FichaTreino{}},
		treinos: &fakeTreinos{},
		sub:     personalID.String(),
	}
	alunos := &fakeAlunos{pertence: true}
	e.alunos = alunos

	svc := application.NewTrainingService(e.fichas, e.treinos, nil, fakeLeitura{}, nil, alunos, nil, nil)
	h := NewTrainingHandler(svc)

	e.app = fiber.New()
	h.RegisterPersonalRoutes(e.app, func(c fiber.Ctx) error {
		c.Locals("user_id", e.sub)
		return c.Next()
	})
	return e
}

func (e *env) fichaDe(personalID uuid.UUID, ativa bool) *domain.FichaTreino {
	f := &domain.FichaTreino{
		ID: uuid.New(), AlunoID: uuid.New(), PersonalID: personalID,
		Nome: "Ficha", Ativa: ativa, VigenciaInicio: time.Now(),
	}
	e.fichas.porID[f.ID] = f
	return f
}

func (e *env) do(t *testing.T, method, path string, body any) (int, []byte) {
	t.Helper()
	var rd io.Reader
	switch b := body.(type) {
	case nil:
	case string:
		rd = bytes.NewBufferString(b)
	default:
		raw, err := json.Marshal(b)
		if err != nil {
			t.Fatal(err)
		}
		rd = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, rd)
	req.Header.Set("Content-Type", "application/json")

	resp, err := e.app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, raw
}

func problema(t *testing.T, raw []byte) middleware.ProblemDetail {
	t.Helper()
	var p middleware.ProblemDetail
	if err := json.Unmarshal(raw, &p); err != nil {
		t.Fatalf("corpo nao e Problem Details: %s (%v)", raw, err)
	}
	return p
}

// ── POST /fichas ───────────────────────────────────────────────────────────

func TestCriarFicha_Sucesso(t *testing.T) {
	personal := uuid.New()
	e := novoEnv(t, personal)
	aluno := uuid.New()

	status, raw := e.do(t, http.MethodPost, "/fichas", map[string]string{
		"aluno_id": aluno.String(), "nome": "  Hipertrofia A  ",
		"vigencia_inicio": "2026-10-01", "vigencia_fim": "2026-12-31",
	})

	if status != http.StatusCreated {
		t.Fatalf("status = %d, want 201 (%s)", status, raw)
	}
	if len(e.fichas.criadas) != 1 {
		t.Fatalf("ficha deveria ter sido persistida uma vez, got %d", len(e.fichas.criadas))
	}
	f := e.fichas.criadas[0]
	if f.PersonalID != personal || f.AlunoID != aluno || f.Nome != "Hipertrofia A" || !f.Ativa || f.VigenciaFim == nil {
		t.Errorf("ficha persistida inesperada: %+v", f)
	}
	var resp application.FichaResponse
	if err := json.Unmarshal(raw, &resp); err != nil || resp.Nome != "Hipertrofia A" {
		t.Errorf("resposta inesperada: %s (%v)", raw, err)
	}
}

func TestCriarFicha_AlunoDeOutroPersonal_404SemVazarExistencia(t *testing.T) {
	e := novoEnv(t, uuid.New())
	e.alunos.pertence = false

	status, raw := e.do(t, http.MethodPost, "/fichas", map[string]string{
		"aluno_id": uuid.NewString(), "nome": "Ficha", "vigencia_inicio": "2026-10-01",
	})

	if status != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", status)
	}
	if p := problema(t, raw); p.Detail != "ficha não encontrada" {
		t.Errorf("detail = %q", p.Detail)
	}
	if len(e.fichas.criadas) != 0 {
		t.Error("nao deveria persistir nada")
	}
}

func TestCriarFicha_CorpoInvalido(t *testing.T) {
	e := novoEnv(t, uuid.New())

	status, raw := e.do(t, http.MethodPost, "/fichas", "{isso nao e json")

	if status != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", status)
	}
	if p := problema(t, raw); p.Type != "https://amfit.local/errors/bad-request" {
		t.Errorf("type = %q", p.Type)
	}
}

func TestCriarFicha_ValidacaoRetorna422ComErrosPorCampo(t *testing.T) {
	e := novoEnv(t, uuid.New())

	status, raw := e.do(t, http.MethodPost, "/fichas", map[string]string{
		"aluno_id": "nao-e-uuid", "nome": "x", "vigencia_inicio": "01/10/2026",
	})

	if status != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", status)
	}
	p := problema(t, raw)
	campos := map[string]string{}
	for _, fe := range p.Errors {
		campos[fe.Field] = fe.Message
	}
	for _, campo := range []string{"alunoid", "nome", "vigenciainicio"} {
		if campos[campo] == "" {
			t.Errorf("faltou erro para o campo %q: %v", campo, campos)
		}
	}
	if len(e.fichas.criadas) != 0 {
		t.Error("payload invalido nao pode chegar ao repositorio")
	}
}

func TestCriarFicha_SubInvalidoNoToken_401(t *testing.T) {
	e := novoEnv(t, uuid.New())
	e.sub = "isso-nao-e-uuid"

	status, _ := e.do(t, http.MethodPost, "/fichas", map[string]string{
		"aluno_id": uuid.NewString(), "nome": "Ficha", "vigencia_inicio": "2026-10-01",
	})

	if status != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", status)
	}
}

func TestCriarFicha_FalhaDoRepositorio_500ComMensagemGenerica(t *testing.T) {
	e := novoEnv(t, uuid.New())
	e.fichas.createErr = errors.New("connection refused: 10.0.0.5:5432")

	status, raw := e.do(t, http.MethodPost, "/fichas", map[string]string{
		"aluno_id": uuid.NewString(), "nome": "Ficha", "vigencia_inicio": "2026-10-01",
	})

	if status != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", status)
	}
	if bytes.Contains(raw, []byte("10.0.0.5")) {
		t.Errorf("erro interno vazou na resposta: %s", raw)
	}
	if p := problema(t, raw); p.Detail != "falha ao criar ficha" {
		t.Errorf("detail = %q", p.Detail)
	}
}

// ── GET /fichas ────────────────────────────────────────────────────────────

func TestListarFichas_RepassaFiltros(t *testing.T) {
	personal := uuid.New()
	aluno := uuid.New()
	e := novoEnv(t, personal)

	status, _ := e.do(t, http.MethodGet, "/fichas?aluno_id="+aluno.String()+"&ativa=true", nil)

	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	f := e.fichas.filtro
	if f.PersonalID != personal || f.AlunoID == nil || *f.AlunoID != aluno || f.Ativa == nil || !*f.Ativa {
		t.Errorf("filtro inesperado: %+v", f)
	}
}

func TestListarFichas_SemParametros_NaoFiltra(t *testing.T) {
	e := novoEnv(t, uuid.New())

	status, _ := e.do(t, http.MethodGet, "/fichas", nil)

	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if e.fichas.filtro.AlunoID != nil || e.fichas.filtro.Ativa != nil {
		t.Errorf("sem query params nao deveria filtrar: %+v", e.fichas.filtro)
	}
}

func TestListarFichas_ParametrosInvalidos_400(t *testing.T) {
	for _, qs := range []string{"?aluno_id=xyz", "?ativa=talvez"} {
		t.Run(qs, func(t *testing.T) {
			e := novoEnv(t, uuid.New())
			if status, _ := e.do(t, http.MethodGet, "/fichas"+qs, nil); status != http.StatusBadRequest {
				t.Errorf("status = %d, want 400", status)
			}
		})
	}
}

// ── GET /fichas/:id ────────────────────────────────────────────────────────

func TestBuscarFicha(t *testing.T) {
	personal := uuid.New()
	e := novoEnv(t, personal)
	propria := e.fichaDe(personal, true)
	alheia := e.fichaDe(uuid.New(), true)

	t.Run("propria: 200", func(t *testing.T) {
		status, raw := e.do(t, http.MethodGet, "/fichas/"+propria.ID.String(), nil)
		if status != http.StatusOK {
			t.Fatalf("status = %d (%s)", status, raw)
		}
		var resp application.FichaResponse
		_ = json.Unmarshal(raw, &resp)
		if resp.ID != propria.ID.String() {
			t.Errorf("id = %q", resp.ID)
		}
	})

	t.Run("id malformado: 400", func(t *testing.T) {
		if status, _ := e.do(t, http.MethodGet, "/fichas/abc", nil); status != http.StatusBadRequest {
			t.Errorf("status = %d, want 400", status)
		}
	})

	t.Run("inexistente e de outro personal sao indistinguiveis (anti-enumeration)", func(t *testing.T) {
		sNaoExiste, bNaoExiste := e.do(t, http.MethodGet, "/fichas/"+uuid.NewString(), nil)
		sAlheia, bAlheia := e.do(t, http.MethodGet, "/fichas/"+alheia.ID.String(), nil)

		if sNaoExiste != http.StatusNotFound || sAlheia != http.StatusNotFound {
			t.Fatalf("status = %d / %d, want 404 / 404", sNaoExiste, sAlheia)
		}
		if !bytes.Equal(bNaoExiste, bAlheia) {
			t.Errorf("respostas diferentes vazam existencia:\n%s\n%s", bNaoExiste, bAlheia)
		}
	})
}

// ── DELETE /fichas/:id ─────────────────────────────────────────────────────

func TestDesativarFicha(t *testing.T) {
	personal := uuid.New()
	e := novoEnv(t, personal)

	t.Run("ativa: 204 e desativa", func(t *testing.T) {
		f := e.fichaDe(personal, true)
		if status, _ := e.do(t, http.MethodDelete, "/fichas/"+f.ID.String(), nil); status != http.StatusNoContent {
			t.Fatalf("status = %d, want 204", status)
		}
		if len(e.fichas.desativadas) != 1 || e.fichas.desativadas[0] != f.ID {
			t.Errorf("desativadas = %v", e.fichas.desativadas)
		}
	})

	t.Run("ja inativa: 204 idempotente, sem tocar no repositorio", func(t *testing.T) {
		e.fichas.desativadas = nil
		f := e.fichaDe(personal, false)
		if status, _ := e.do(t, http.MethodDelete, "/fichas/"+f.ID.String(), nil); status != http.StatusNoContent {
			t.Fatalf("status = %d, want 204", status)
		}
		if len(e.fichas.desativadas) != 0 {
			t.Errorf("nao deveria desativar de novo: %v", e.fichas.desativadas)
		}
	})

	t.Run("de outro personal: 404 e nada e desativado", func(t *testing.T) {
		e.fichas.desativadas = nil
		f := e.fichaDe(uuid.New(), true)
		if status, _ := e.do(t, http.MethodDelete, "/fichas/"+f.ID.String(), nil); status != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", status)
		}
		if len(e.fichas.desativadas) != 0 {
			t.Errorf("ficha alheia foi desativada: %v", e.fichas.desativadas)
		}
	})
}

// ── POST /fichas/:fichaId/treinos ──────────────────────────────────────────

func TestCriarTreino(t *testing.T) {
	personal := uuid.New()
	e := novoEnv(t, personal)
	ficha := e.fichaDe(personal, true)
	path := "/fichas/" + ficha.ID.String() + "/treinos"

	t.Run("sucesso: 201 e a letra vai em maiuscula", func(t *testing.T) {
		status, raw := e.do(t, http.MethodPost, path, map[string]any{"letra": "b", "nome": "Costas", "ordem": 1})
		if status != http.StatusCreated {
			t.Fatalf("status = %d (%s)", status, raw)
		}
		if len(e.treinos.criados) != 1 || e.treinos.criados[0].Letra != "B" || e.treinos.criados[0].FichaID != ficha.ID {
			t.Errorf("treino persistido inesperado: %+v", e.treinos.criados)
		}
	})

	t.Run("letra repetida na ficha: 409", func(t *testing.T) {
		e.treinos.createErr = domain.ErrLetraJaUsada
		defer func() { e.treinos.createErr = nil }()

		status, raw := e.do(t, http.MethodPost, path, map[string]any{"letra": "A"})

		if status != http.StatusConflict {
			t.Fatalf("status = %d, want 409", status)
		}
		if p := problema(t, raw); p.Detail != "já existe um treino com essa letra na ficha" {
			t.Errorf("detail = %q", p.Detail)
		}
	})

	t.Run("letra maior que 2 caracteres: 422", func(t *testing.T) {
		if status, _ := e.do(t, http.MethodPost, path, map[string]any{"letra": "ABC"}); status != http.StatusUnprocessableEntity {
			t.Errorf("status = %d, want 422", status)
		}
	})

	t.Run("fichaId malformado: 400", func(t *testing.T) {
		if status, _ := e.do(t, http.MethodPost, "/fichas/xyz/treinos", map[string]any{"letra": "A"}); status != http.StatusBadRequest {
			t.Errorf("status = %d, want 400", status)
		}
	})

	t.Run("ficha de outro personal: 404 sem criar treino", func(t *testing.T) {
		antes := len(e.treinos.criados)
		alheia := e.fichaDe(uuid.New(), true)

		status, _ := e.do(t, http.MethodPost, "/fichas/"+alheia.ID.String()+"/treinos", map[string]any{"letra": "C"})

		if status != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", status)
		}
		if len(e.treinos.criados) != antes {
			t.Error("treino criado em ficha alheia")
		}
	})
}
