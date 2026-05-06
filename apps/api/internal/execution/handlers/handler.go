// Package handlers contém os handlers HTTP do contexto Execution.
package handlers

import (
	"github.com/amfit/api/internal/execution/application"
	"github.com/gofiber/fiber/v3"
)

// ExecutionHandler expõe os endpoints de sessões de treino.
type ExecutionHandler struct {
	svc *application.ExecutionService
}

// NewExecutionHandler cria o handler com o serviço injetado.
func NewExecutionHandler(svc *application.ExecutionService) *ExecutionHandler {
	return &ExecutionHandler{svc: svc}
}

// Register monta as rotas do contexto Execution no router fornecido.
func (h *ExecutionHandler) Register(router fiber.Router) {
	router.Post("/sessoes", h.StartSessao)
	router.Patch("/sessoes/:id/series", h.RecordSerie)
	router.Patch("/sessoes/:id/concluir", h.ConcluirSessao)
}

// StartSessao inicia uma nova sessão de treino para o aluno autenticado.
func (h *ExecutionHandler) StartSessao(c fiber.Ctx) error {
	return c.SendStatus(fiber.StatusNotImplemented)
}

// RecordSerie registra o resultado de uma série executada.
func (h *ExecutionHandler) RecordSerie(c fiber.Ctx) error {
	return c.SendStatus(fiber.StatusNotImplemented)
}

// ConcluirSessao marca a sessão como concluída.
func (h *ExecutionHandler) ConcluirSessao(c fiber.Ctx) error {
	return c.SendStatus(fiber.StatusNotImplemented)
}
