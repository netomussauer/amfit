// Package handlers contém os handlers HTTP do contexto Progress.
package handlers

import (
	"github.com/amfit/api/internal/progress/application"
	"github.com/amfit/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
)

// ProgressHandler expõe os endpoints de progresso e medidas corporais.
type ProgressHandler struct {
	svc *application.ProgressService
}

// NewProgressHandler cria o handler com o serviço injetado.
func NewProgressHandler(svc *application.ProgressService) *ProgressHandler {
	return &ProgressHandler{svc: svc}
}

// Register monta as rotas do contexto Progress no router fornecido.
// mws é a chain aplicada por rota (tipicamente: auth).
func (h *ProgressHandler) Register(router fiber.Router, mws ...fiber.Handler) {
	middleware.Get(router, "/alunos/:id/progresso/:exercicio_id", mws, h.GetProgressoExercicio)
	middleware.Get(router, "/dashboard", mws, h.GetDashboard)
}

// GetProgressoExercicio retorna o histórico de carga de um exercício para o aluno.
func (h *ProgressHandler) GetProgressoExercicio(c fiber.Ctx) error {
	return c.SendStatus(fiber.StatusNotImplemented)
}

// GetDashboard retorna os dados do dashboard do personal trainer autenticado.
func (h *ProgressHandler) GetDashboard(c fiber.Ctx) error {
	return c.SendStatus(fiber.StatusNotImplemented)
}
