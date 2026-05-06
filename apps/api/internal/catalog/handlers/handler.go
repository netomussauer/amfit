// Package handlers contém os handlers HTTP do contexto Catalog.
package handlers

import (
	"github.com/amfit/api/internal/catalog/application"
	"github.com/gofiber/fiber/v3"
)

// CatalogHandler expõe os endpoints de exercícios e grupos musculares.
type CatalogHandler struct {
	svc *application.CatalogService
}

// NewCatalogHandler cria o handler com o serviço injetado.
func NewCatalogHandler(svc *application.CatalogService) *CatalogHandler {
	return &CatalogHandler{svc: svc}
}

// Register monta as rotas do contexto Catalog no router fornecido.
func (h *CatalogHandler) Register(router fiber.Router) {
	router.Get("/exercicios", h.ListExercicios)
	router.Post("/exercicios", h.CreateExercicio)
	router.Get("/exercicios/:id", h.GetExercicio)

	router.Get("/grupos-musculares", h.ListGruposMusculares)
}

// ListExercicios lista exercícios globais e do personal autenticado.
func (h *CatalogHandler) ListExercicios(c fiber.Ctx) error {
	// TODO: implementar listagem com filtros (grupo_muscular_id, busca)
	return c.SendStatus(fiber.StatusNotImplemented)
}

// CreateExercicio cria um exercício customizado com upload de mídia opcional.
func (h *CatalogHandler) CreateExercicio(c fiber.Ctx) error {
	// TODO: implementar criação com upload multipart para MinIO
	return c.SendStatus(fiber.StatusNotImplemented)
}

// GetExercicio retorna um exercício pelo ID.
func (h *CatalogHandler) GetExercicio(c fiber.Ctx) error {
	// TODO: implementar busca por ID
	return c.SendStatus(fiber.StatusNotImplemented)
}

// ListGruposMusculares lista todos os grupos musculares cadastrados.
func (h *CatalogHandler) ListGruposMusculares(c fiber.Ctx) error {
	// TODO: implementar listagem de grupos musculares
	return c.SendStatus(fiber.StatusNotImplemented)
}
