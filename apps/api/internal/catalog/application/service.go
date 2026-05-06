// Package application contém os casos de uso do contexto Catalog.
package application

import "github.com/amfit/api/internal/catalog/domain"

// CatalogService agrupa os casos de uso de gestão de exercícios e grupos musculares.
type CatalogService struct {
	exercicios     domain.ExercicioRepository
	gruposMusculares domain.GrupoMuscularRepository
}

// NewCatalogService cria o CatalogService com as dependências fornecidas.
func NewCatalogService(
	exercicios domain.ExercicioRepository,
	gruposMusculares domain.GrupoMuscularRepository,
) *CatalogService {
	return &CatalogService{
		exercicios:       exercicios,
		gruposMusculares: gruposMusculares,
	}
}
