// Package handlers contém os handlers HTTP do contexto Financial.
package handlers

import (
	"errors"
	"strconv"

	"github.com/amfit/api/internal/financial/application"
	"github.com/amfit/api/internal/financial/domain"
	"github.com/amfit/api/pkg/middleware"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// FinancialHandler expõe os endpoints de plano e mensalidades.
type FinancialHandler struct {
	svc      *application.FinancialService
	validate *validator.Validate
}

// NewFinancialHandler cria o handler com o serviço injetado.
func NewFinancialHandler(svc *application.FinancialService) *FinancialHandler {
	return &FinancialHandler{
		svc:      svc,
		validate: validator.New(validator.WithRequiredStructEnabled()),
	}
}

// RegisterAlunoRoutes registra as rotas que o ALUNO consome sobre o próprio
// plano/mensalidades.
func (h *FinancialHandler) RegisterAlunoRoutes(router fiber.Router, mws ...fiber.Handler) {
	middleware.Get(router, "/alunos/me/plano", mws, h.ObterMeuPlano)
	middleware.Get(router, "/alunos/me/mensalidades", mws, h.ListarMinhasMensalidades)
}

// RegisterPersonalRoutes registra as rotas que o PERSONAL consome para
// configurar planos e gerenciar mensalidades dos seus alunos.
func (h *FinancialHandler) RegisterPersonalRoutes(router fiber.Router, mws ...fiber.Handler) {
	middleware.Post(router, "/alunos/:alunoId/plano", mws, h.ConfigurarPlano)
	middleware.Get(router, "/alunos/:alunoId/plano", mws, h.ObterPlanoDoAluno)
	middleware.Patch(router, "/planos/:id", mws, h.AtualizarPlano)
	middleware.Get(router, "/mensalidades", mws, h.ListarMensalidades)
	middleware.Patch(router, "/mensalidades/:id/marcar-paga", mws, h.MarcarPaga)
	middleware.Patch(router, "/mensalidades/:id", mws, h.AtualizarStatusMensalidade)
	middleware.Get(router, "/financeiro/dashboard", mws, h.Dashboard)
}

// ─── Personal: plano ────────────────────────────────────────────────────

// ConfigurarPlano trata POST /alunos/:alunoId/plano (role=PERSONAL).
func (h *FinancialHandler) ConfigurarPlano(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	alunoID, err := uuid.Parse(c.Params("alunoId"))
	if err != nil {
		return badRequest(c, "alunoId invalido")
	}

	var req application.CriarPlanoRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	resp, err := h.svc.ConfigurarPlano(c.Context(), personalID, alunoID, req)
	if err != nil {
		return writeFinancialError(c, err, "falha ao configurar plano")
	}
	return c.Status(fiber.StatusCreated).JSON(resp)
}

// ObterPlanoDoAluno trata GET /alunos/:alunoId/plano (role=PERSONAL).
func (h *FinancialHandler) ObterPlanoDoAluno(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	alunoID, err := uuid.Parse(c.Params("alunoId"))
	if err != nil {
		return badRequest(c, "alunoId invalido")
	}

	resp, err := h.svc.ObterPlanoDoAluno(c.Context(), personalID, alunoID)
	if err != nil {
		return writeFinancialError(c, err, "falha ao buscar plano")
	}
	return c.JSON(resp)
}

// AtualizarPlano trata PATCH /planos/:id (role=PERSONAL).
func (h *FinancialHandler) AtualizarPlano(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	planoID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badRequest(c, "id invalido")
	}

	var req application.AtualizarPlanoRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	resp, err := h.svc.AtualizarPlano(c.Context(), personalID, planoID, req)
	if err != nil {
		return writeFinancialError(c, err, "falha ao atualizar plano")
	}
	return c.JSON(resp)
}

// ─── Aluno: plano próprio ───────────────────────────────────────────────

// ObterMeuPlano trata GET /alunos/me/plano (role=ALUNO).
func (h *FinancialHandler) ObterMeuPlano(c fiber.Ctx) error {
	alunoID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	resp, err := h.svc.ObterMeuPlanoAtivo(c.Context(), alunoID)
	if err != nil {
		return writeFinancialError(c, err, "falha ao buscar plano")
	}
	return c.JSON(resp)
}

// ─── Mensalidades ───────────────────────────────────────────────────────

// ListarMensalidades trata GET /mensalidades (role=PERSONAL).
func (h *FinancialHandler) ListarMensalidades(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	req, perr := parseListarMensalidadesParams(c, true)
	if perr != nil {
		return middleware.WriteProblem(c, *perr)
	}

	resp, err := h.svc.ListarMensalidadesDoPersonal(c.Context(), personalID, req)
	if err != nil {
		return writeFinancialError(c, err, "falha ao listar mensalidades")
	}
	return c.JSON(resp)
}

// ListarMinhasMensalidades trata GET /alunos/me/mensalidades (role=ALUNO).
func (h *FinancialHandler) ListarMinhasMensalidades(c fiber.Ctx) error {
	alunoID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	req, perr := parseListarMensalidadesParams(c, false)
	if perr != nil {
		return middleware.WriteProblem(c, *perr)
	}

	resp, err := h.svc.ListarMinhasMensalidades(c.Context(), alunoID, req)
	if err != nil {
		return writeFinancialError(c, err, "falha ao listar mensalidades")
	}
	return c.JSON(resp)
}

// MarcarPaga trata PATCH /mensalidades/:id/marcar-paga (role=PERSONAL).
func (h *FinancialHandler) MarcarPaga(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	mensalidadeID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badRequest(c, "id invalido")
	}

	var req application.MarcarPagaRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	resp, err := h.svc.MarcarPaga(c.Context(), personalID, mensalidadeID, req)
	if err != nil {
		return writeFinancialError(c, err, "falha ao marcar mensalidade como paga")
	}
	return c.JSON(resp)
}

// AtualizarStatusMensalidade trata PATCH /mensalidades/:id (role=PERSONAL).
func (h *FinancialHandler) AtualizarStatusMensalidade(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	mensalidadeID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badRequest(c, "id invalido")
	}

	var req application.AtualizarStatusMensalidadeRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	resp, err := h.svc.AtualizarStatusMensalidade(c.Context(), personalID, mensalidadeID, req)
	if err != nil {
		return writeFinancialError(c, err, "falha ao atualizar mensalidade")
	}
	return c.JSON(resp)
}

// ─── Dashboard ──────────────────────────────────────────────────────────

// Dashboard trata GET /financeiro/dashboard (role=PERSONAL).
func (h *FinancialHandler) Dashboard(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	resp, err := h.svc.Dashboard(c.Context(), personalID)
	if err != nil {
		log.Error().Err(err).Str("personal_id", personalID.String()).Msg("financeiro dashboard query failed")
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao buscar dashboard financeiro",
		))
	}
	return c.JSON(resp)
}

// ─── Helpers ────────────────────────────────────────────────────────────

// statusMensalidadeValidos é o whitelist usado para validar o filtro
// ?status= — sem essa checagem, um valor desconhecido só falharia lá na
// frente como erro de cast do Postgres ($3::status_mensalidade), virando um
// 500 genérico em vez do 400 que um filtro inválido deveria devolver.
var statusMensalidadeValidos = map[string]bool{
	string(domain.StatusMensalidadePendente):  true,
	string(domain.StatusMensalidadePaga):      true,
	string(domain.StatusMensalidadeAtrasada):  true,
	string(domain.StatusMensalidadeCancelada): true,
	string(domain.StatusMensalidadeIsenta):    true,
}

func parseListarMensalidadesParams(c fiber.Ctx, aceitaAlunoID bool) (application.ListarMensalidadesRequest, *middleware.ProblemDetail) {
	var req application.ListarMensalidadesRequest

	if aceitaAlunoID {
		if v := c.Query("aluno_id", ""); v != "" {
			req.AlunoID = &v
		}
	}
	if v := c.Query("status", ""); v != "" {
		if !statusMensalidadeValidos[v] {
			pd := middleware.NewProblem(fiber.StatusBadRequest, "bad-request", "Bad Request", "status invalido")
			return req, &pd
		}
		req.Status = &v
	}
	if v := c.Query("competencia_ano", ""); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			pd := middleware.NewProblem(fiber.StatusBadRequest, "bad-request", "Bad Request", "competencia_ano invalido")
			return req, &pd
		}
		req.CompetenciaAno = &n
	}
	if v := c.Query("competencia_mes", ""); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 12 {
			pd := middleware.NewProblem(fiber.StatusBadRequest, "bad-request", "Bad Request", "competencia_mes invalido")
			return req, &pd
		}
		req.CompetenciaMes = &n
	}
	// page/per_page: invalidos sao silenciosamente ignorados (ficam nos
	// defaults do service) em vez de 400 — mesmo comportamento de
	// paginationFromQuery em execution/handlers/handler.go.
	if v := c.Query("page", ""); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			req.Page = n
		}
	}
	if v := c.Query("per_page", ""); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			req.PerPage = n
		}
	}
	return req, nil
}

func (h *FinancialHandler) bindAndValidate(c fiber.Ctx, dst any) bool {
	if err := c.Bind().Body(dst); err != nil {
		_ = middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"corpo da requisicao invalido",
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
		"dados invalidos",
	)
	var ve validator.ValidationErrors
	if errors.As(err, &ve) {
		p.Errors = make([]middleware.ProblemFieldError, 0, len(ve))
		for _, fe := range ve {
			p.Errors = append(p.Errors, middleware.ProblemFieldError{
				Field:   fe.Field(),
				Message: fe.Tag(),
			})
		}
	}
	return p
}

func badRequest(c fiber.Ctx, msg string) error {
	return middleware.WriteProblem(c, middleware.NewProblem(
		fiber.StatusBadRequest, "bad-request", "Bad Request", msg,
	))
}

func userIDFromCtx(c fiber.Ctx) (uuid.UUID, bool) {
	raw, _ := c.Locals("user_id").(string)
	id, err := uuid.Parse(raw)
	if err != nil {
		_ = middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusUnauthorized, "unauthorized", "Unauthorized",
			"sub invalido no token",
		))
		return uuid.Nil, false
	}
	return id, true
}

func writeFinancialError(c fiber.Ctx, err error, fallback string) error {
	switch {
	case errors.Is(err, domain.ErrPlanoNaoEncontrado), errors.Is(err, domain.ErrMensalidadeNaoEncontrada):
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusNotFound, "not-found", "Not Found", "recurso nao encontrado",
		))
	case errors.Is(err, domain.ErrPlanoJaAtivo), errors.Is(err, domain.ErrMensalidadeJaPaga),
		errors.Is(err, domain.ErrStatusMensalidadeInvalido):
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusConflict, "conflict", "Conflict", err.Error(),
		))
	}
	log.Error().Err(err).Str("path", c.Path()).Msg("financial handler error")
	return middleware.WriteProblem(c, middleware.NewProblem(
		fiber.StatusInternalServerError, "internal", "Internal Server Error", fallback,
	))
}
