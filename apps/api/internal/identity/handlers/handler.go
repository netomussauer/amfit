// Package handlers contém os handlers HTTP do contexto Identity.
package handlers

import (
	"errors"
	"strconv"
	"strings"

	"github.com/amfit/api/internal/identity/application"
	"github.com/amfit/api/internal/identity/domain"
	"github.com/amfit/api/pkg/middleware"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// IdentityHandler expõe os endpoints de autenticação e gestão de usuários.
type IdentityHandler struct {
	svc      *application.IdentityService
	validate *validator.Validate
}

// NewIdentityHandler cria o handler com o serviço injetado.
func NewIdentityHandler(svc *application.IdentityService) *IdentityHandler {
	return &IdentityHandler{
		svc:      svc,
		validate: validator.New(validator.WithRequiredStructEnabled()),
	}
}

// RegisterPublic registra as rotas públicas do contexto Identity.
func (h *IdentityHandler) RegisterPublic(router fiber.Router) {
	router.Post("/auth/register-personal", h.RegisterPersonal)
	router.Post("/auth/login", h.Login)
	router.Post("/auth/refresh", h.Refresh)
}

// RegisterAuthenticated registra rotas que exigem qualquer usuário autenticado.
// mws é a chain aplicada por rota (tipicamente: auth).
func (h *IdentityHandler) RegisterAuthenticated(router fiber.Router, mws ...fiber.Handler) {
	middleware.Post(router, "/auth/logout", mws, h.Logout)
}

// RegisterPersonalRoutes registra rotas restritas ao role PERSONAL.
// mws é a chain aplicada por rota (tipicamente: auth + RequireRole("PERSONAL")).
func (h *IdentityHandler) RegisterPersonalRoutes(router fiber.Router, mws ...fiber.Handler) {
	middleware.Post(router, "/alunos", mws, h.CriarAluno)
	middleware.Get(router, "/alunos", mws, h.ListarAlunos)
	middleware.Get(router, "/alunos/:id", mws, h.BuscarAluno)
	middleware.Patch(router, "/alunos/:id", mws, h.AtualizarAluno)
	middleware.Delete(router, "/alunos/:id", mws, h.DesativarAluno)
	middleware.Get(router, "/personal/me", mws, h.BuscarMeuPerfilPersonal)
	middleware.Patch(router, "/personal/me", mws, h.AtualizarMeuPerfilPersonal)
	middleware.Patch(router, "/personal/me/senha", mws, h.AlterarMinhaSenha)
}

// RegisterAlunoRoutes registra rotas restritas ao role ALUNO.
// mws é a chain aplicada por rota (tipicamente: auth + RequireRole("ALUNO")).
func (h *IdentityHandler) RegisterAlunoRoutes(router fiber.Router, mws ...fiber.Handler) {
	middleware.Get(router, "/alunos/me", mws, h.BuscarMeuPerfil)
}

// ── Auth ───────────────────────────────────────────────────────────────────

// RegisterPersonal trata POST /auth/register-personal.
func (h *IdentityHandler) RegisterPersonal(c fiber.Ctx) error {
	var req application.RegisterPersonalRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	resp, err := h.svc.Auth.RegisterPersonal(c.Context(), req)
	if err != nil {
		if errors.Is(err, domain.ErrEmailAlreadyExists) {
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusConflict, "conflict", "Conflict",
				"email já cadastrado",
			))
		}
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao registrar personal",
		))
	}
	return c.Status(fiber.StatusCreated).JSON(resp)
}

// Login trata POST /auth/login.
func (h *IdentityHandler) Login(c fiber.Ctx) error {
	var req application.LoginRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	resp, err := h.svc.Auth.Login(c.Context(), req)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidCredentials) {
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusUnauthorized, "unauthorized", "Unauthorized",
				"credenciais inválidas",
			))
		}
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao autenticar",
		))
	}
	return c.JSON(resp)
}

// Refresh trata POST /auth/refresh.
func (h *IdentityHandler) Refresh(c fiber.Ctx) error {
	var req application.RefreshRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	resp, err := h.svc.Auth.Refresh(c.Context(), req.RefreshToken)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidRefreshToken) || errors.Is(err, domain.ErrRefreshTokenRevoked) {
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusUnauthorized, "unauthorized", "Unauthorized",
				"refresh token inválido",
			))
		}
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha no refresh",
		))
	}
	return c.JSON(resp)
}

// Logout trata POST /auth/logout.
func (h *IdentityHandler) Logout(c fiber.Ctx) error {
	var req application.LogoutRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	if err := h.svc.Auth.Logout(c.Context(), req.RefreshToken); err != nil {
		if errors.Is(err, domain.ErrInvalidRefreshToken) {
			return c.SendStatus(fiber.StatusNoContent)
		}
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha no logout",
		))
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ── Alunos ─────────────────────────────────────────────────────────────────

// CriarAluno trata POST /alunos (role=PERSONAL).
func (h *IdentityHandler) CriarAluno(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}

	var req application.CriarAlunoRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	resp, err := h.svc.Aluno.CriarAluno(c.Context(), personalID, req)
	if err != nil {
		if errors.Is(err, domain.ErrEmailAlreadyExists) {
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusConflict, "conflict", "Conflict",
				"email já cadastrado",
			))
		}
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao criar aluno",
		))
	}
	return c.Status(fiber.StatusCreated).JSON(resp)
}

// ListarAlunos trata GET /alunos (role=PERSONAL).
func (h *IdentityHandler) ListarAlunos(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "20"))

	var ativo *bool
	if v := c.Query("ativo"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusBadRequest, "bad-request", "Bad Request",
				"parâmetro ativo inválido",
			))
		}
		ativo = &b
	}

	resp, err := h.svc.Aluno.ListarAlunos(c.Context(), personalID, page, perPage, ativo)
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao listar alunos",
		))
	}
	return c.JSON(resp)
}

// BuscarAluno trata GET /alunos/:id (role=PERSONAL).
func (h *IdentityHandler) BuscarAluno(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	alunoID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"id inválido",
		))
	}

	resp, err := h.svc.Aluno.BuscarAluno(c.Context(), personalID, alunoID)
	if err != nil {
		if errors.Is(err, domain.ErrAlunoNotFound) {
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusNotFound, "not-found", "Not Found",
				"aluno não encontrado",
			))
		}
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao buscar aluno",
		))
	}
	return c.JSON(resp)
}

// BuscarMeuPerfil trata GET /alunos/me (role=ALUNO).
func (h *IdentityHandler) BuscarMeuPerfil(c fiber.Ctx) error {
	alunoID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}

	resp, err := h.svc.Aluno.BuscarAlunoSelf(c.Context(), alunoID)
	if err != nil {
		if errors.Is(err, domain.ErrAlunoNotFound) {
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusNotFound, "not-found", "Not Found",
				"aluno não encontrado",
			))
		}
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao buscar perfil",
		))
	}
	return c.JSON(resp)
}

// AtualizarAluno trata PATCH /alunos/:id (role=PERSONAL).
func (h *IdentityHandler) AtualizarAluno(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	alunoID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"id inválido",
		))
	}

	var req application.AtualizarAlunoRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	resp, err := h.svc.Aluno.AtualizarAluno(c.Context(), personalID, alunoID, req)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrAlunoNotFound):
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusNotFound, "not-found", "Not Found",
				"aluno não encontrado",
			))
		case errors.Is(err, domain.ErrEmailAlreadyExists):
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusConflict, "conflict", "Conflict",
				"email já cadastrado",
			))
		}
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao atualizar aluno",
		))
	}
	return c.JSON(resp)
}

// DesativarAluno trata DELETE /alunos/:id (role=PERSONAL).
func (h *IdentityHandler) DesativarAluno(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	alunoID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"id inválido",
		))
	}

	if err := h.svc.Aluno.DesativarAluno(c.Context(), personalID, alunoID); err != nil {
		if errors.Is(err, domain.ErrAlunoNotFound) {
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusNotFound, "not-found", "Not Found",
				"aluno não encontrado",
			))
		}
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao desativar aluno",
		))
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ── Personal (autoatendimento) ──────────────────────────────────────────────

// BuscarMeuPerfilPersonal trata GET /personal/me (role=PERSONAL).
func (h *IdentityHandler) BuscarMeuPerfilPersonal(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}

	resp, err := h.svc.Personal.BuscarPersonalSelf(c.Context(), personalID)
	if err != nil {
		if errors.Is(err, domain.ErrPersonalNotFound) {
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusNotFound, "not-found", "Not Found",
				"personal não encontrado",
			))
		}
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao buscar perfil",
		))
	}
	return c.JSON(resp)
}

// AtualizarMeuPerfilPersonal trata PATCH /personal/me (role=PERSONAL).
func (h *IdentityHandler) AtualizarMeuPerfilPersonal(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}

	var req application.AtualizarPersonalRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	resp, err := h.svc.Personal.AtualizarPersonal(c.Context(), personalID, req)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrPersonalNotFound):
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusNotFound, "not-found", "Not Found",
				"personal não encontrado",
			))
		case errors.Is(err, domain.ErrEmailAlreadyExists):
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusConflict, "conflict", "Conflict",
				"email já cadastrado",
			))
		}
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao atualizar perfil",
		))
	}
	return c.JSON(resp)
}

// AlterarMinhaSenha trata PATCH /personal/me/senha (role=PERSONAL).
func (h *IdentityHandler) AlterarMinhaSenha(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}

	var req application.AlterarSenhaRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	if err := h.svc.Personal.AlterarSenha(c.Context(), personalID, req); err != nil {
		if errors.Is(err, domain.ErrSenhaAtualIncorreta) {
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusUnprocessableEntity, "validation", "Unprocessable Entity",
				"senha atual incorreta",
			))
		}
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao alterar senha",
		))
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ── Helpers ────────────────────────────────────────────────────────────────

// bindAndValidate parseia o body JSON e roda as tags de validação do struct.
// Retorna ok=true quando o request é válido. Quando ok=false, a resposta de
// erro (400/422) já foi escrita e o caller deve retornar nil imediatamente
// para não acionar o error handler padrão do Fiber.
func (h *IdentityHandler) bindAndValidate(c fiber.Ctx, dst any) bool {
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

// validationProblem constrói um ProblemDetail RFC 7807 a partir de erros do validator.
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
	case "email":
		return "deve ser um e-mail válido"
	case "min":
		return "valor abaixo do mínimo (" + fe.Param() + ")"
	case "max":
		return "valor acima do máximo (" + fe.Param() + ")"
	case "oneof":
		return "valor não permitido (esperado: " + fe.Param() + ")"
	case "datetime":
		return "data inválida (formato esperado: " + fe.Param() + ")"
	default:
		return "valor inválido"
	}
}

// userIDFromCtx lê o claim sub do contexto Fiber e devolve um UUID.
// Quando ok=false, a resposta 401 já foi escrita — o caller deve retornar nil
// imediatamente para não acionar o error handler padrão do Fiber.
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
