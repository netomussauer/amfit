package middleware

import "github.com/gofiber/fiber/v3"

// Chain devolve um novo slice [mws..., handler] com cópia defensiva — evita
// que o backing array de `mws` seja reaproveitado/mutado entre rotas quando o
// mesmo slice de middlewares é usado em múltiplos `router.Get/Post(...)`.
//
// Uso típico:
//
//	router.Get("/x", middleware.Chain(mws, h.HandleX)...)
//
// Existe porque em Fiber v3 o padrão `router.Group("", middleware)` muta o
// router pai (contamina rotas registradas depois). Aplicar middlewares por
// rota é o workaround canônico.
func Chain(mws []fiber.Handler, handler fiber.Handler) []fiber.Handler {
	out := make([]fiber.Handler, 0, len(mws)+1)
	out = append(out, mws...)
	return append(out, handler)
}
