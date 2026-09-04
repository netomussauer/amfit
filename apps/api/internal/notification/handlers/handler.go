// Package handlers contém os handlers HTTP do contexto Notification.
package handlers

import (
	"errors"
	"strings"

	"github.com/amfit/api/internal/notification/application"
	"github.com/amfit/api/internal/notification/domain"
	"github.com/amfit/api/pkg/middleware"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// NotificationHandler expõe os endpoints de push token.
type NotificationHandler struct {
	svc      *application.NotificationService
	validate *validator.Validate
}

// NewNotificationHandler cria o handler com o serviço injetado.
func NewNotificationHandler(svc *application.NotificationService) *NotificationHandler {
	return &NotificationHandler{
		svc:      svc,
		validate: validator.New(validator.WithRequiredStructEnabled()),
	}
}

// RegisterAuthenticated registra as rotas acessíveis a qualquer role
// autenticada (PERSONAL ou ALUNO) — ambos registram push token com a
// mesma rota; o owner_tipo é resolvido a partir do claim `role` do JWT.
func (h *NotificationHandler) RegisterAuthenticated(router fiber.Router, mws ...fiber.Handler) {
	middleware.Post(router, "/push-token", mws, h.RegistrarPushToken)
}

// RegistrarPushToken trata POST /push-token (qualquer role autenticada).
func (h *NotificationHandler) RegistrarPushToken(c fiber.Ctx) error {
	ownerID, ownerTipo, ok := ownerFromCtx(c)
	if !ok {
		return nil
	}

	var req registrarPushTokenRequestDTO
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	err := h.svc.RegistrarPushToken(c.Context(), ownerID, ownerTipo, application.RegistrarPushTokenRequest{
		Token:      req.Token,
		Plataforma: domain.Plataforma(req.Plataforma),
	})
	if err != nil {
		if errors.Is(err, domain.ErrTokenInvalido) {
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusUnprocessableEntity, "validation", "Unprocessable Entity",
				"token invalido",
			))
		}
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao registrar push token",
		))
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ─── DTOs de entrada ────────────────────────────────────────────────────

type registrarPushTokenRequestDTO struct {
	Token      string `json:"token" validate:"required"`
	Plataforma string `json:"plataforma" validate:"required,oneof=ANDROID IOS"`
}

// ─── Helpers ───────────────────────────────────────────────────────────

// ownerFromCtx lê user_id e role do contexto Fiber (preenchidos pelo
// middleware de auth) e devolve o OwnerTipo correspondente.
func ownerFromCtx(c fiber.Ctx) (uuid.UUID, domain.OwnerTipo, bool) {
	raw, _ := c.Locals("user_id").(string)
	id, err := uuid.Parse(raw)
	if err != nil {
		_ = middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusUnauthorized, "unauthorized", "Unauthorized",
			"sub invalido no token",
		))
		return uuid.Nil, "", false
	}

	role, _ := c.Locals("role").(string)
	switch role {
	case string(domain.OwnerPersonal):
		return id, domain.OwnerPersonal, true
	case string(domain.OwnerAluno):
		return id, domain.OwnerAluno, true
	default:
		_ = middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusUnauthorized, "unauthorized", "Unauthorized",
			"role invalida no token",
		))
		return uuid.Nil, "", false
	}
}

func (h *NotificationHandler) bindAndValidate(c fiber.Ctx, dst any) bool {
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
		return "campo obrigatorio"
	case "oneof":
		return "valor deve ser um de: " + fe.Param()
	default:
		return "valor invalido"
	}
}
