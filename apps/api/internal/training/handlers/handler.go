// Package handlers contém os handlers HTTP do contexto Training.
package handlers

import (
	"errors"
	"strconv"
	"strings"

	"github.com/amfit/api/internal/training/application"
	"github.com/amfit/api/internal/training/domain"
	"github.com/amfit/api/pkg/middleware"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// TrainingHandler expõe os endpoints de fichas, treinos e itens de treino.
type TrainingHandler struct {
	svc      *application.TrainingService
	validate *validator.Validate
}

// NewTrainingHandler cria o handler com o serviço injetado.
func NewTrainingHandler(svc *application.TrainingService) *TrainingHandler {
	return &TrainingHandler{
		svc:      svc,
		validate: validator.New(validator.WithRequiredStructEnabled()),
	}
}

// RegisterPersonalRoutes registra as rotas restritas ao role PERSONAL.
// mws é a chain aplicada por rota (tipicamente: auth + RequireRole("PERSONAL")).
func (h *TrainingHandler) RegisterPersonalRoutes(router fiber.Router, mws ...fiber.Handler) {
	middleware.Post(router, "/fichas", mws, h.CriarFicha)
	middleware.Get(router, "/fichas", mws, h.ListarFichas)
	middleware.Get(router, "/fichas/:id", mws, h.BuscarFicha)
	middleware.Patch(router, "/fichas/:id", mws, h.AtualizarFicha)
	middleware.Delete(router, "/fichas/:id", mws, h.DesativarFicha)

	middleware.Post(router, "/fichas/:fichaId/treinos", mws, h.CriarTreino)
	middleware.Patch(router, "/treinos/:id", mws, h.AtualizarTreino)
	middleware.Delete(router, "/treinos/:id", mws, h.RemoverTreino)

	middleware.Post(router, "/treinos/:treinoId/itens", mws, h.CriarItemTreino)
	middleware.Patch(router, "/treinos/:treinoId/itens/reordenar", mws, h.ReordenarItens)

	middleware.Patch(router, "/itens/:id", mws, h.AtualizarItemTreino)
	middleware.Delete(router, "/itens/:id", mws, h.RemoverItemTreino)
}

// RegisterAlunoRoutes registra as rotas restritas ao role ALUNO.
// mws é a chain aplicada por rota (tipicamente: auth + RequireRole("ALUNO")).
func (h *TrainingHandler) RegisterAlunoRoutes(router fiber.Router, mws ...fiber.Handler) {
	middleware.Get(router, "/alunos/me/treino-hoje", mws, h.TreinoHoje)
	middleware.Get(router, "/alunos/me/ficha", mws, h.MinhaFicha)
}

// ── Fichas ─────────────────────────────────────────────────────────────────

// CriarFicha trata POST /fichas (role=PERSONAL).
func (h *TrainingHandler) CriarFicha(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}

	var req application.CriarFichaRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	resp, err := h.svc.CriarFicha(c.Context(), personalID, req)
	if err != nil {
		return writeFichaError(c, err, "falha ao criar ficha")
	}
	return c.Status(fiber.StatusCreated).JSON(resp)
}

// ListarFichas trata GET /fichas (role=PERSONAL).
//
// Query params:
//   - aluno_id (opcional, UUID) — restringe ao aluno informado
//   - ativa    (opcional, bool) — true|false; quando ausente lista todas
func (h *TrainingHandler) ListarFichas(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}

	var alunoID *uuid.UUID
	if v := c.Query("aluno_id", ""); v != "" {
		id, err := uuid.Parse(v)
		if err != nil {
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusBadRequest, "bad-request", "Bad Request",
				"aluno_id inválido",
			))
		}
		alunoID = &id
	}

	var ativa *bool
	if v := c.Query("ativa", ""); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusBadRequest, "bad-request", "Bad Request",
				"parâmetro ativa inválido",
			))
		}
		ativa = &b
	}

	resp, err := h.svc.ListarFichas(c.Context(), personalID, alunoID, ativa)
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao listar fichas",
		))
	}
	return c.JSON(resp)
}

// BuscarFicha trata GET /fichas/:id (role=PERSONAL) — devolve a ficha completa.
func (h *TrainingHandler) BuscarFicha(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	fichaID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"id inválido",
		))
	}

	resp, err := h.svc.BuscarFicha(c.Context(), personalID, fichaID)
	if err != nil {
		return writeFichaError(c, err, "falha ao buscar ficha")
	}
	return c.JSON(resp)
}

// AtualizarFicha trata PATCH /fichas/:id (role=PERSONAL).
func (h *TrainingHandler) AtualizarFicha(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	fichaID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"id inválido",
		))
	}

	var req application.AtualizarFichaRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	resp, err := h.svc.AtualizarFicha(c.Context(), personalID, fichaID, req)
	if err != nil {
		return writeFichaError(c, err, "falha ao atualizar ficha")
	}
	return c.JSON(resp)
}

// DesativarFicha trata DELETE /fichas/:id (role=PERSONAL).
func (h *TrainingHandler) DesativarFicha(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	fichaID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"id inválido",
		))
	}

	if err := h.svc.DesativarFicha(c.Context(), personalID, fichaID); err != nil {
		return writeFichaError(c, err, "falha ao desativar ficha")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ── Treinos ────────────────────────────────────────────────────────────────

// CriarTreino trata POST /fichas/:fichaId/treinos (role=PERSONAL).
func (h *TrainingHandler) CriarTreino(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	fichaID, err := uuid.Parse(c.Params("fichaId"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"fichaId inválido",
		))
	}

	var req application.CriarTreinoRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	resp, err := h.svc.CriarTreino(c.Context(), personalID, fichaID, req)
	if err != nil {
		return writeTreinoError(c, err, "falha ao criar treino")
	}
	return c.Status(fiber.StatusCreated).JSON(resp)
}

// AtualizarTreino trata PATCH /treinos/:id (role=PERSONAL).
func (h *TrainingHandler) AtualizarTreino(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	treinoID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"id inválido",
		))
	}

	var req application.AtualizarTreinoRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	resp, err := h.svc.AtualizarTreino(c.Context(), personalID, treinoID, req)
	if err != nil {
		return writeTreinoError(c, err, "falha ao atualizar treino")
	}
	return c.JSON(resp)
}

// RemoverTreino trata DELETE /treinos/:id (role=PERSONAL).
func (h *TrainingHandler) RemoverTreino(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	treinoID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"id inválido",
		))
	}

	if err := h.svc.RemoverTreino(c.Context(), personalID, treinoID); err != nil {
		return writeTreinoError(c, err, "falha ao remover treino")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ── Itens de treino ────────────────────────────────────────────────────────

// CriarItemTreino trata POST /treinos/:treinoId/itens (role=PERSONAL).
func (h *TrainingHandler) CriarItemTreino(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	treinoID, err := uuid.Parse(c.Params("treinoId"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"treinoId inválido",
		))
	}

	var req application.CriarItemTreinoRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	resp, err := h.svc.CriarItemTreino(c.Context(), personalID, treinoID, req)
	if err != nil {
		return writeItemError(c, err, "falha ao criar item de treino")
	}
	return c.Status(fiber.StatusCreated).JSON(resp)
}

// AtualizarItemTreino trata PATCH /itens/:id (role=PERSONAL).
func (h *TrainingHandler) AtualizarItemTreino(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	itemID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"id inválido",
		))
	}

	var req application.AtualizarItemTreinoRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	resp, err := h.svc.AtualizarItemTreino(c.Context(), personalID, itemID, req)
	if err != nil {
		return writeItemError(c, err, "falha ao atualizar item")
	}
	return c.JSON(resp)
}

// RemoverItemTreino trata DELETE /itens/:id (role=PERSONAL).
func (h *TrainingHandler) RemoverItemTreino(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	itemID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"id inválido",
		))
	}

	if err := h.svc.RemoverItemTreino(c.Context(), personalID, itemID); err != nil {
		return writeItemError(c, err, "falha ao remover item")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ReordenarItens trata PATCH /treinos/:treinoId/itens/reordenar (role=PERSONAL).
func (h *TrainingHandler) ReordenarItens(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	treinoID, err := uuid.Parse(c.Params("treinoId"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"treinoId inválido",
		))
	}

	var req application.ReordenarItensRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	if err := h.svc.ReordenarItens(c.Context(), personalID, treinoID, req); err != nil {
		switch {
		case errors.Is(err, domain.ErrTreinoNotFound), errors.Is(err, domain.ErrTreinoForbidden):
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusNotFound, "not-found", "Not Found", "treino não encontrado",
			))
		case errors.Is(err, domain.ErrReorderInconsistente):
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusUnprocessableEntity, "validation", "Unprocessable Entity",
				"lista de itens não bate com o conteúdo do treino",
			))
		}
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao reordenar itens",
		))
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ── Aluno ──────────────────────────────────────────────────────────────────

// TreinoHoje trata GET /alunos/me/treino-hoje (role=ALUNO).
func (h *TrainingHandler) TreinoHoje(c fiber.Ctx) error {
	alunoID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}

	resp, err := h.svc.ObterTreinoHoje(c.Context(), alunoID)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrSemFichaAtiva), errors.Is(err, domain.ErrSemTreinoHoje):
			return c.SendStatus(fiber.StatusNoContent)
		}
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao obter treino do dia",
		))
	}
	return c.JSON(resp)
}

// MinhaFicha trata GET /alunos/me/ficha (role=ALUNO).
func (h *TrainingHandler) MinhaFicha(c fiber.Ctx) error {
	alunoID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}

	resp, err := h.svc.BuscarFichaAtivaDoAluno(c.Context(), alunoID)
	if err != nil {
		if errors.Is(err, domain.ErrSemFichaAtiva) {
			return c.SendStatus(fiber.StatusNoContent)
		}
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao obter ficha ativa",
		))
	}
	return c.JSON(resp)
}

// ── Helpers ────────────────────────────────────────────────────────────────

// bindAndValidate parseia o body JSON e roda as tags de validação do struct.
// Quando ok=false a resposta de erro (400/422) já foi escrita.
func (h *TrainingHandler) bindAndValidate(c fiber.Ctx, dst any) bool {
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
	case "datetime":
		return "data inválida (formato esperado: " + fe.Param() + ")"
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

// writeFichaError centraliza a tradução de erros do domínio Ficha em
// ProblemDetails. Aplica a regra anti-enumeration: NotFound e Forbidden
// devolvem 404 idêntico para o caller que NÃO é o dono.
func writeFichaError(c fiber.Ctx, err error, fallback string) error {
	switch {
	case errors.Is(err, domain.ErrFichaNotFound), errors.Is(err, domain.ErrFichaForbidden):
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusNotFound, "not-found", "Not Found",
			"ficha não encontrada",
		))
	}
	return middleware.WriteProblem(c, middleware.NewProblem(
		fiber.StatusInternalServerError, "internal", "Internal Server Error",
		fallback,
	))
}

// writeTreinoError traduz erros do domínio Treino. Inclui o caminho 409 da
// UNIQUE (ficha_id, letra) para criação/atualização.
func writeTreinoError(c fiber.Ctx, err error, fallback string) error {
	switch {
	case errors.Is(err, domain.ErrTreinoNotFound), errors.Is(err, domain.ErrTreinoForbidden):
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusNotFound, "not-found", "Not Found",
			"treino não encontrado",
		))
	case errors.Is(err, domain.ErrFichaNotFound), errors.Is(err, domain.ErrFichaForbidden):
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusNotFound, "not-found", "Not Found",
			"ficha não encontrada",
		))
	case errors.Is(err, domain.ErrLetraJaUsada):
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusConflict, "conflict", "Conflict",
			"já existe um treino com essa letra na ficha",
		))
	}
	return middleware.WriteProblem(c, middleware.NewProblem(
		fiber.StatusInternalServerError, "internal", "Internal Server Error",
		fallback,
	))
}

// writeItemError traduz erros do domínio Item.
func writeItemError(c fiber.Ctx, err error, fallback string) error {
	switch {
	case errors.Is(err, domain.ErrItemTreinoNotFound), errors.Is(err, domain.ErrItemTreinoForbidden):
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusNotFound, "not-found", "Not Found",
			"item de treino não encontrado",
		))
	case errors.Is(err, domain.ErrTreinoNotFound), errors.Is(err, domain.ErrTreinoForbidden):
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusNotFound, "not-found", "Not Found",
			"treino não encontrado",
		))
	}
	return middleware.WriteProblem(c, middleware.NewProblem(
		fiber.StatusInternalServerError, "internal", "Internal Server Error",
		fallback,
	))
}
