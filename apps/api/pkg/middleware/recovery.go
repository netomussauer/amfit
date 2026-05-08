package middleware

import (
	"github.com/gofiber/fiber/v3"
	"github.com/rs/zerolog/log"
)

// Recovery captura panics em handlers, loga o stack trace e retorna HTTP 500.
func Recovery() fiber.Handler {
	return func(c fiber.Ctx) (err error) {
		defer func() {
			if r := recover(); r != nil {
				log.Error().
					Interface("panic", r).
					Str("path", c.Path()).
					Msg("recovered from panic")

				err = WriteProblem(c, NewProblem(
					fiber.StatusInternalServerError,
					"internal", "Internal Server Error",
					"an unexpected error occurred",
				))
			}
		}()

		return c.Next()
	}
}
