// Package application contém os casos de uso do contexto Execution.
package application

import "github.com/amfit/api/internal/execution/domain"

// ExecutionService agrupa os casos de uso de registro e acompanhamento de sessões.
type ExecutionService struct {
	sessoes   domain.SessaoTreinoRepository
	registros domain.RegistroSerieRepository
}

// NewExecutionService cria o ExecutionService com as dependências fornecidas.
func NewExecutionService(
	sessoes domain.SessaoTreinoRepository,
	registros domain.RegistroSerieRepository,
) *ExecutionService {
	return &ExecutionService{
		sessoes:   sessoes,
		registros: registros,
	}
}
