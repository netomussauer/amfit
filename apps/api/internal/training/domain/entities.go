// Package domain define as entidades e tipos do contexto Training.
package domain

import (
	"time"

	"github.com/google/uuid"
)

// FichaTreino é a coleção de treinos atribuída a um aluno por um personal.
type FichaTreino struct {
	ID             uuid.UUID
	AlunoID        uuid.UUID
	PersonalID     uuid.UUID
	Nome           string
	VigenciaInicio time.Time
	VigenciaFim    *time.Time
	Ativa          bool
	CriadoEm      time.Time
	AtualizadoEm  time.Time
}

// Treino é um conjunto de exercícios identificado por letra (A, B, C...).
type Treino struct {
	ID      uuid.UUID
	FichaID uuid.UUID
	Letra   string
	Nome    *string
	Ordem   int
}

// ItemTreino é uma entrada na ficha — exercício com parâmetros prescritos.
type ItemTreino struct {
	ID               uuid.UUID
	TreinoID         uuid.UUID
	ExercicioID      uuid.UUID
	Ordem            int
	Series           int
	Repeticoes       string
	CargaSugerida    *float64
	DescansoSegundos *int
	Observacao       *string
}
