// Package application contém os casos de uso do contexto Training.
package application

import "github.com/amfit/api/internal/training/domain"

// TrainingService agrupa os casos de uso de montagem e consulta de fichas de treino.
type TrainingService struct {
	fichas domain.FichaTreinoRepository
	treinos domain.TreinoRepository
	itens   domain.ItemTreinoRepository
}

// NewTrainingService cria o TrainingService com as dependências fornecidas.
func NewTrainingService(
	fichas domain.FichaTreinoRepository,
	treinos domain.TreinoRepository,
	itens domain.ItemTreinoRepository,
) *TrainingService {
	return &TrainingService{
		fichas:  fichas,
		treinos: treinos,
		itens:   itens,
	}
}
