// Package middleware fornece middlewares Fiber reutilizáveis.
package middleware

import (
	"crypto/rsa"
	"strings"

	"github.com/amfit/api/pkg/auth"
	"github.com/gofiber/fiber/v3"
)

// NewAuthMiddleware retorna um middleware que extrai e valida o Bearer token,
// injetando user_id, role e tenant_id no contexto do Fiber.
func NewAuthMiddleware(publicKey *rsa.PublicKey) fiber.Handler {
	return func(c fiber.Ctx) error {
		header := c.Get("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			return WriteProblem(c, NewProblem(
				fiber.StatusUnauthorized,
				"unauthorized", "Unauthorized",
				"missing or malformed Authorization header",
			))
		}

		tokenStr := strings.TrimPrefix(header, "Bearer ")

		claims, err := auth.VerifyToken(tokenStr, publicKey)
		if err != nil {
			return WriteProblem(c, NewProblem(
				fiber.StatusUnauthorized,
				"unauthorized", "Unauthorized",
				"invalid or expired token",
			))
		}

		c.Locals("user_id", claims["sub"])
		c.Locals("role", claims["role"])
		c.Locals("tenant_id", claims["tenant_id"])

		return c.Next()
	}
}

// RequireRole devolve um middleware que rejeita requisições cujo claim role
// no contexto do Fiber não corresponde ao role exigido.
func RequireRole(role string) fiber.Handler {
	return func(c fiber.Ctx) error {
		current, _ := c.Locals("role").(string)
		if current != role {
			return WriteProblem(c, NewProblem(
				fiber.StatusForbidden,
				"forbidden", "Forbidden",
				"role does not allow this resource",
			))
		}
		return c.Next()
	}
}
