// Package middleware fornece middlewares Fiber reutilizáveis.
package middleware

import (
	"crypto/rsa"
	"strings"

	"github.com/amfit/api/pkg/auth"
	"github.com/gofiber/fiber/v3"
)

// problemDetail representa a estrutura RFC 7807 para erros de API.
type problemDetail struct {
	Type   string `json:"type"`
	Title  string `json:"title"`
	Status int    `json:"status"`
	Detail string `json:"detail"`
}

// NewAuthMiddleware retorna um middleware que extrai e valida o Bearer token,
// injetando user_id, role e tenant_id no contexto do Fiber.
func NewAuthMiddleware(publicKey *rsa.PublicKey) fiber.Handler {
	return func(c fiber.Ctx) error {
		header := c.Get("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			return c.Status(fiber.StatusUnauthorized).JSON(problemDetail{
				Type:   "https://amfit.local/errors/unauthorized",
				Title:  "Unauthorized",
				Status: fiber.StatusUnauthorized,
				Detail: "missing or malformed Authorization header",
			})
		}

		tokenStr := strings.TrimPrefix(header, "Bearer ")

		claims, err := auth.VerifyToken(tokenStr, publicKey)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(problemDetail{
				Type:   "https://amfit.local/errors/unauthorized",
				Title:  "Unauthorized",
				Status: fiber.StatusUnauthorized,
				Detail: "invalid or expired token",
			})
		}

		c.Locals("user_id", claims["sub"])
		c.Locals("role", claims["role"])
		c.Locals("tenant_id", claims["tenant_id"])

		return c.Next()
	}
}
