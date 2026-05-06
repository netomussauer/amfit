// Package domain define as entidades e tipos do contexto Execution.
package domain

import (
	"time"

	"github.com/google/uuid"
)

// StatusSessao representa o estado de uma sessão de treino.
type StatusSessao string

const (
	StatusEmAndamento StatusSessao = "EM_ANDAMENTO"
	StatusConcluido   StatusSessao = "CONCLUIDO"
	StatusAbandonado  StatusSessao = "ABANDONADO"
)

// SessaoTreino registra a execução de um treino em uma data específica.
type SessaoTreino struct {
	ID            uuid.UUID
	AlunoID       uuid.UUID
	TreinoID      uuid.UUID
	DataExecucao  time.Time
	Status        StatusSessao
	IniciadoEm   time.Time
	ConcluidoEm  *time.Time
	Observacao    *string
}

// RegistroSerie captura os dados reais de execução de uma série.
type RegistroSerie struct {
	ID                  uuid.UUID
	SessaoID            uuid.UUID
	ItemTreinoID        uuid.UUID
	NumeroSerie         int
	CargaRealizada      *float64
	RepeticoesRealizadas *int
	Concluida           bool
	ExecutadoEm         *time.Time
}
