package middleware

import "github.com/gofiber/fiber/v3"

// Em Fiber v3, a assinatura é `Get(path, handler, middleware...)` — porém a
// ORDEM DE EXECUÇÃO é: middleware roda primeiro (na ordem fornecida) e o
// handler roda por último, como handler final que produz a resposta.
//
// Por isso os helpers abaixo passam `h` na posição de handler e expandem
// `mws...` na posição variádica — assim a execução fica
// `mws[0] → mws[1] → ... → h`.
//
// Existem porque em Fiber v3 o padrão `router.Group("", middleware)` muta o
// router pai e contamina rotas registradas depois — aplicar middlewares por
// rota é o workaround canônico.

// Get registra um GET com `mws` rodando antes de `h`.
func Get(r fiber.Router, path string, mws []fiber.Handler, h fiber.Handler) {
	r.Get(path, h, mws...)
}

// Post registra um POST com `mws` rodando antes de `h`.
func Post(r fiber.Router, path string, mws []fiber.Handler, h fiber.Handler) {
	r.Post(path, h, mws...)
}

// Patch registra um PATCH com `mws` rodando antes de `h`.
func Patch(r fiber.Router, path string, mws []fiber.Handler, h fiber.Handler) {
	r.Patch(path, h, mws...)
}

// Delete registra um DELETE com `mws` rodando antes de `h`.
func Delete(r fiber.Router, path string, mws []fiber.Handler, h fiber.Handler) {
	r.Delete(path, h, mws...)
}
