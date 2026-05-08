package handlers

import (
	"errors"
	"strings"

	"github.com/amfit/api/pkg/middleware"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// maxAbsoluteUploadBytes é o teto absoluto de tamanho aceito pelo handler
// antes de delegar a validação fina (por tipo) ao service. Mantemos um valor
// folgado em relação ao limite de vídeo para evitar abrir streams muito
// grandes em memória/disk-buffer do parser multipart.
const maxAbsoluteUploadBytes = 12 * 1024 * 1024 // 12 MB

// bindAndValidate parseia o body JSON e roda as tags de validação do struct.
// Retorna ok=true quando o request é válido. Quando ok=false, a resposta de
// erro (400/422) já foi escrita.
func (h *CatalogHandler) bindAndValidate(c fiber.Ctx, dst any) bool {
	if err := c.Bind().Body(dst); err != nil {
		_ = middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"corpo da requisição inválido",
		))
		return false
	}
	return h.validateInput(c, dst)
}

// validateInput aplica apenas a validação (sem bind) — útil para inputs
// montados a partir de multipart/form-data, em que o bind JSON não se aplica.
func (h *CatalogHandler) validateInput(c fiber.Ctx, dst any) bool {
	if err := h.validate.Struct(dst); err != nil {
		_ = middleware.WriteProblem(c, validationProblem(err))
		return false
	}
	return true
}

// validationProblem constrói um ProblemDetail a partir de erros do validator.
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
// Quando ok=false a resposta 401 já foi escrita.
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

// personalIDForList determina qual personal_id usar como filtro de
// visibilidade nas listagens/busca: o próprio sub para PERSONAL e o tenant_id
// (personal vinculado) para ALUNO.
func personalIDForList(c fiber.Ctx) (uuid.UUID, bool) {
	role, _ := c.Locals("role").(string)

	switch role {
	case "PERSONAL":
		return userIDFromCtx(c)
	case "ALUNO":
		raw, _ := c.Locals("tenant_id").(string)
		id, err := uuid.Parse(raw)
		if err != nil {
			_ = middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusUnauthorized, "unauthorized", "Unauthorized",
				"tenant_id inválido no token",
			))
			return uuid.Nil, false
		}
		return id, true
	default:
		_ = middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusForbidden, "forbidden", "Forbidden",
			"role não autorizada",
		))
		return uuid.Nil, false
	}
}

// firstFormValue devolve o primeiro valor de uma chave no map de campos
// textuais do multipart, ou "" se ausente.
func firstFormValue(values map[string][]string, key string) string {
	v := values[key]
	if len(v) == 0 {
		return ""
	}
	return v[0]
}
