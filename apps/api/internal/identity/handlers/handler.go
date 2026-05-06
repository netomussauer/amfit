// Package handlers contém os handlers HTTP do contexto Identity.
package handlers

import (
	"github.com/amfit/api/internal/identity/application"
	"github.com/gofiber/fiber/v3"
)

// IdentityHandler expõe os endpoints de autenticação e gestão de usuários.
type IdentityHandler struct {
	svc *application.IdentityService
}

// NewIdentityHandler cria o handler com o serviço injetado.
func NewIdentityHandler(svc *application.IdentityService) *IdentityHandler {
	return &IdentityHandler{svc: svc}
}

// Register monta as rotas do contexto Identity no router fornecido.
func (h *IdentityHandler) Register(router fiber.Router) {
	auth := router.Group("/auth")
	auth.Post("/login", h.Login)
	auth.Post("/refresh", h.Refresh)
	auth.Post("/logout", h.Logout)
}

// Login autentica um personal trainer ou aluno e retorna os tokens de acesso.
func (h *IdentityHandler) Login(c fiber.Ctx) error {
	// TODO: implementar caso de uso de login
	return c.SendStatus(fiber.StatusNotImplemented)
}

// Refresh renova o access token usando o refresh token.
func (h *IdentityHandler) Refresh(c fiber.Ctx) error {
	// TODO: implementar caso de uso de refresh
	return c.SendStatus(fiber.StatusNotImplemented)
}

// Logout revoga o refresh token ativo.
func (h *IdentityHandler) Logout(c fiber.Ctx) error {
	// TODO: implementar caso de uso de logout
	return c.SendStatus(fiber.StatusNotImplemented)
}
