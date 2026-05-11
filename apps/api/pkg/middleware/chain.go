package middleware

import "github.com/gofiber/fiber/v3"

// As assinaturas de fiber.Router (Get/Post/Patch/Delete) são
// `(path string, handler fiber.Handler, middleware ...fiber.Handler)` — o
// primeiro handler é obrigatório, NÃO variádico. Por isso não podemos fazer
// `router.Get(path, chain...)` direto, porque o spread de um único slice não
// consegue preencher `(Handler, ...Handler)`.
//
// Os helpers abaixo aceitam um slice de middlewares (`mws`) e um handler
// final, montam a chain com cópia defensiva e chamam o método correto do
// router separando primeiro elemento dos demais.
//
// Existem porque em Fiber v3 o padrão `router.Group("", middleware)` muta o
// router pai e contamina rotas registradas depois — aplicar middlewares por
// rota é o workaround canônico.

// Get registra um GET aplicando mws antes do handler final.
func Get(r fiber.Router, path string, mws []fiber.Handler, h fiber.Handler) {
	first, rest := chain(mws, h)
	r.Get(path, first, rest...)
}

// Post registra um POST aplicando mws antes do handler final.
func Post(r fiber.Router, path string, mws []fiber.Handler, h fiber.Handler) {
	first, rest := chain(mws, h)
	r.Post(path, first, rest...)
}

// Patch registra um PATCH aplicando mws antes do handler final.
func Patch(r fiber.Router, path string, mws []fiber.Handler, h fiber.Handler) {
	first, rest := chain(mws, h)
	r.Patch(path, first, rest...)
}

// Delete registra um DELETE aplicando mws antes do handler final.
func Delete(r fiber.Router, path string, mws []fiber.Handler, h fiber.Handler) {
	first, rest := chain(mws, h)
	r.Delete(path, first, rest...)
}

// chain devolve (primeiro, resto...) garantindo cópia defensiva para não
// reaproveitar o backing array de `mws` entre chamadas.
func chain(mws []fiber.Handler, h fiber.Handler) (fiber.Handler, []fiber.Handler) {
	if len(mws) == 0 {
		return h, nil
	}
	rest := make([]fiber.Handler, 0, len(mws))
	rest = append(rest, mws[1:]...)
	rest = append(rest, h)
	return mws[0], rest
}
