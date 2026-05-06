// Package handlers contém os handlers HTTP do contexto Training.
package handlers

import (
	"github.com/amfit/api/internal/training/application"
	"github.com/gofiber/fiber/v3"
)

// TrainingHandler expõe os endpoints de fichas e treinos.
type TrainingHandler struct {
	svc *application.TrainingService
}

// NewTrainingHandler cria o handler com o serviço injetado.
func NewTrainingHandler(svc *application.TrainingService) *TrainingHandler {
	return &TrainingHandler{svc: svc}
}

// Register monta as rotas do contexto Training no router fornecido.
func (h *TrainingHandler) Register(router fiber.Router) {
	router.Get("/fichas", h.ListFichas)
	router.Post("/fichas", h.CreateFicha)
	router.Post("/fichas/:id/treinos", h.AddTreino)
	router.Post("/treinos/:id/itens", h.AddItemTreino)

	router.Get("/alunos/me/treino-hoje", h.TreinoHoje)
}

// ListFichas lista fichas de treino filtradas por aluno_id e/ou ativa.
func (h *TrainingHandler) ListFichas(c fiber.Ctx) error {
	return c.SendStatus(fiber.StatusNotImplemented)
}

// CreateFicha cria uma nova ficha de treino para um aluno.
func (h *TrainingHandler) CreateFicha(c fiber.Ctx) error {
	return c.SendStatus(fiber.StatusNotImplemented)
}

// AddTreino adiciona um treino (A/B/C) à ficha.
func (h *TrainingHandler) AddTreino(c fiber.Ctx) error {
	return c.SendStatus(fiber.StatusNotImplemented)
}

// AddItemTreino adiciona um exercício a um treino.
func (h *TrainingHandler) AddItemTreino(c fiber.Ctx) error {
	return c.SendStatus(fiber.StatusNotImplemented)
}

// TreinoHoje retorna o treino do dia para o aluno autenticado.
func (h *TrainingHandler) TreinoHoje(c fiber.Ctx) error {
	return c.SendStatus(fiber.StatusNotImplemented)
}
