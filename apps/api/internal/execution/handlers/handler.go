// Package handlers contém os handlers HTTP do contexto Execution.
package handlers

import (
	"errors"
	"strconv"
	"strings"

	"github.com/amfit/api/internal/execution/application"
	"github.com/amfit/api/internal/execution/domain"
	"github.com/amfit/api/pkg/middleware"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// ExecutionHandler expõe os endpoints de sessões de treino.
type ExecutionHandler struct {
	svc      *application.ExecutionService
	validate *validator.Validate
}

// NewExecutionHandler cria o handler com o serviço injetado.
func NewExecutionHandler(svc *application.ExecutionService) *ExecutionHandler {
	return &ExecutionHandler{
		svc:      svc,
		validate: validator.New(validator.WithRequiredStructEnabled()),
	}
}

// RegisterAlunoRoutes registra as rotas restritas ao role ALUNO.
// mws é a chain aplicada por rota (tipicamente: auth + RequireRole("ALUNO")).
func (h *ExecutionHandler) RegisterAlunoRoutes(router fiber.Router, mws ...fiber.Handler) {
	router.Post("/sessoes", middleware.Chain(mws, h.IniciarSessao)...)
	router.Get("/sessoes/:id", middleware.Chain(mws, h.BuscarSessao)...)
	router.Patch("/sessoes/:id/series", middleware.Chain(mws, h.RegistrarSerie)...)
	router.Patch("/sessoes/:id/concluir", middleware.Chain(mws, h.ConcluirSessao)...)
	router.Get("/alunos/me/sessoes", middleware.Chain(mws, h.ListarMinhasSessoes)...)
}

// RegisterPersonalRoutes registra as rotas restritas ao role PERSONAL.
// mws é a chain aplicada por rota (tipicamente: auth + RequireRole("PERSONAL")).
func (h *ExecutionHandler) RegisterPersonalRoutes(router fiber.Router, mws ...fiber.Handler) {
	router.Get("/alunos/:alunoId/sessoes", middleware.Chain(mws, h.ListarSessoesDoAluno)...)
}

// IniciarSessao trata POST /sessoes (role=ALUNO).
func (h *ExecutionHandler) IniciarSessao(c fiber.Ctx) error {
	alunoID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}

	var req application.IniciarSessaoRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	resp, err := h.svc.IniciarSessao(c.Context(), alunoID, req)
	if err != nil {
		return writeSessaoError(c, err, "falha ao iniciar sessão")
	}
	// 200 (e não 201): a chamada é idempotente — pode devolver sessão pré-existente.
	return c.Status(fiber.StatusOK).JSON(resp)
}

// BuscarSessao trata GET /sessoes/:id (role=ALUNO).
func (h *ExecutionHandler) BuscarSessao(c fiber.Ctx) error {
	alunoID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	sessaoID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request", "id inválido",
		))
	}

	resp, err := h.svc.BuscarSessao(c.Context(), alunoID, sessaoID)
	if err != nil {
		return writeSessaoError(c, err, "falha ao buscar sessão")
	}
	return c.JSON(resp)
}

// RegistrarSerie trata PATCH /sessoes/:id/series (role=ALUNO).
func (h *ExecutionHandler) RegistrarSerie(c fiber.Ctx) error {
	alunoID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	sessaoID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request", "id inválido",
		))
	}

	var req application.RegistrarSerieRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	resp, err := h.svc.RegistrarSerie(c.Context(), alunoID, sessaoID, req)
	if err != nil {
		return writeSessaoError(c, err, "falha ao registrar série")
	}
	return c.JSON(resp)
}

// ConcluirSessao trata PATCH /sessoes/:id/concluir (role=ALUNO).
func (h *ExecutionHandler) ConcluirSessao(c fiber.Ctx) error {
	alunoID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	sessaoID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request", "id inválido",
		))
	}

	resp, err := h.svc.ConcluirSessao(c.Context(), alunoID, sessaoID)
	if err != nil {
		return writeSessaoError(c, err, "falha ao concluir sessão")
	}
	return c.JSON(resp)
}

// ListarMinhasSessoes trata GET /alunos/me/sessoes (role=ALUNO).
func (h *ExecutionHandler) ListarMinhasSessoes(c fiber.Ctx) error {
	alunoID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}

	page, perPage := paginationFromQuery(c)
	resp, err := h.svc.ListarMinhasSessoes(c.Context(), alunoID, page, perPage)
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao listar sessões",
		))
	}
	return c.JSON(resp)
}

// ListarSessoesDoAluno trata GET /alunos/:alunoId/sessoes (role=PERSONAL).
func (h *ExecutionHandler) ListarSessoesDoAluno(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	alunoID, err := uuid.Parse(c.Params("alunoId"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request", "alunoId inválido",
		))
	}

	page, perPage := paginationFromQuery(c)
	resp, err := h.svc.ListarSessoesDoAluno(c.Context(), personalID, alunoID, page, perPage)
	if err != nil {
		return writeSessaoError(c, err, "falha ao listar sessões do aluno")
	}
	return c.JSON(resp)
}

// ── Helpers ────────────────────────────────────────────────────────────────

// bindAndValidate parseia o body e roda as validações. Quando ok=false a
// resposta de erro (400/422) já foi escrita.
func (h *ExecutionHandler) bindAndValidate(c fiber.Ctx, dst any) bool {
	if err := c.Bind().Body(dst); err != nil {
		_ = middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"corpo da requisição inválido",
		))
		return false
	}
	if err := h.validate.Struct(dst); err != nil {
		_ = middleware.WriteProblem(c, validationProblem(err))
		return false
	}
	return true
}

func validationProblem(err error) middleware.ProblemDetail {
	p := middleware.NewProblem(
		fiber.StatusUnprocessableEntity, "validation", "Unprocessable Entity",
		"dados inválidos",
	)

	var ve validator.ValidationErrors
	if errors.As(err, &ve) {
		p.Errors = make([]middleware.ProblemFieldError, 0, len(ve))
		for _, fe := range ve {
			p.Errors = append(p.Errors, middleware.ProblemFieldError{
				Field:   strings.ToLower(fe.Field()),
				Message: validationMessage(fe),
			})
		}
	}
	return p
}

func validationMessage(fe validator.FieldError) string {
	switch fe.Tag() {
	case "required":
		return "campo obrigatório"
	case "uuid":
		return "deve ser um UUID válido"
	case "min":
		return "valor abaixo do mínimo (" + fe.Param() + ")"
	case "max":
		return "valor acima do máximo (" + fe.Param() + ")"
	default:
		return "valor inválido"
	}
}

// userIDFromCtx lê o claim sub do contexto Fiber e devolve um UUID.
func userIDFromCtx(c fiber.Ctx) (uuid.UUID, bool) {
	raw, _ := c.Locals("user_id").(string)
	id, err := uuid.Parse(raw)
	if err != nil {
		_ = middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusUnauthorized, "unauthorized", "Unauthorized",
			"sub inválido no token",
		))
		return uuid.Nil, false
	}
	return id, true
}

// paginationFromQuery extrai page/per_page com defaults seguros. Valores
// fora do esperado são silenciosamente normalizados pelo service.
func paginationFromQuery(c fiber.Ctx) (int, int) {
	page := 1
	perPage := 20
	if v := c.Query("page", ""); v != "" {
		if p, err := strconv.Atoi(v); err == nil && p > 0 {
			page = p
		}
	}
	if v := c.Query("per_page", ""); v != "" {
		if pp, err := strconv.Atoi(v); err == nil && pp > 0 {
			perPage = pp
		}
	}
	return page, perPage
}

// writeSessaoError centraliza a tradução de erros do domínio Execution em
// ProblemDetails. Aplica a regra anti-enumeration: NotFound e Forbidden
// devolvem 404 idêntico.
func writeSessaoError(c fiber.Ctx, err error, fallback string) error {
	switch {
	case errors.Is(err, domain.ErrSessaoNotFound),
		errors.Is(err, domain.ErrSessaoForbidden):
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusNotFound, "not-found", "Not Found",
			"sessão não encontrada",
		))
	case errors.Is(err, domain.ErrSessaoJaConcluida):
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusConflict, "conflict", "Conflict",
			"sessão já concluída — não aceita novos registros",
		))
	case errors.Is(err, domain.ErrTreinoInvalido):
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusUnprocessableEntity, "validation", "Unprocessable Entity",
			"treino inválido para o aluno",
		))
	case errors.Is(err, domain.ErrSerieInvalida):
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusUnprocessableEntity, "validation", "Unprocessable Entity",
			"número de série inválido para o item de treino",
		))
	}
	return middleware.WriteProblem(c, middleware.NewProblem(
		fiber.StatusInternalServerError, "internal", "Internal Server Error",
		fallback,
	))
}
