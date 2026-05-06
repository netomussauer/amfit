// Package application contém os casos de uso do contexto Progress.
package application

import "github.com/amfit/api/internal/progress/domain"

// ProgressService agrupa os casos de uso de acompanhamento de evolução do aluno.
type ProgressService struct {
	medidas  domain.MedidaCorporalRepository
	anamnese domain.AnamneseRepository
}

// NewProgressService cria o ProgressService com as dependências fornecidas.
func NewProgressService(
	medidas domain.MedidaCorporalRepository,
	anamnese domain.AnamneseRepository,
) *ProgressService {
	return &ProgressService{
		medidas:  medidas,
		anamnese: anamnese,
	}
}
