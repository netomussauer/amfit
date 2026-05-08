package middleware

import "github.com/gofiber/fiber/v3"

// ProblemDetail representa a estrutura RFC 7807 para erros de API.
type ProblemDetail struct {
	Type   string             `json:"type"`
	Title  string             `json:"title"`
	Status int                `json:"status"`
	Detail string             `json:"detail"`
	Errors []ProblemFieldError `json:"errors,omitempty"`
}

// ProblemFieldError descreve um erro de validação por campo.
type ProblemFieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

const problemTypeBase = "https://amfit.local/errors/"

// NewProblem retorna um ProblemDetail genérico.
func NewProblem(status int, slug, title, detail string) ProblemDetail {
	return ProblemDetail{
		Type:   problemTypeBase + slug,
		Title:  title,
		Status: status,
		Detail: detail,
	}
}

// WriteProblem envia o ProblemDetail como resposta JSON com o status apropriado.
func WriteProblem(c fiber.Ctx, p ProblemDetail) error {
	return c.Status(p.Status).JSON(p)
}
