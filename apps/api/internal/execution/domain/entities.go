// Package domain define as entidades e tipos do contexto Execution.
package domain

import (
	"time"

	"github.com/google/uuid"
)

// StatusSessao representa o estado de uma sessão de treino.
type StatusSessao string

const (
	// StatusEmAndamento indica sessão criada e ainda não concluída.
	StatusEmAndamento StatusSessao = "EM_ANDAMENTO"
	// StatusConcluido indica sessão finalizada com sucesso.
	StatusConcluido StatusSessao = "CONCLUIDO"
	// StatusAbandonado é reservado para uso futuro (cleanup de sessões antigas).
	StatusAbandonado StatusSessao = "ABANDONADO"
)

// SessaoTreino registra a execução de um treino em uma data específica.
//
// DataExecucao é uma DATE (sem hora) por design — uma sessão pertence a um
// dia, mesmo que iniciada à noite e concluída de madrugada. IniciadoEm é o
// timestamp absoluto usado para ordenação fina.
type SessaoTreino struct {
	ID           uuid.UUID
	AlunoID      uuid.UUID
	TreinoID     uuid.UUID
	DataExecucao time.Time
	Status       StatusSessao
	IniciadoEm   time.Time
	ConcluidoEm  *time.Time
	Observacao   string
}

// RegistroSerie captura os dados reais de execução de uma série.
//
// CargaRealizada e RepeticoesRealizadas são opcionais — o aluno pode marcar
// "concluída" sem informar números. ExecutadoEm é populado quando a série
// passa a Concluida=true.
type RegistroSerie struct {
	ID                   uuid.UUID
	SessaoID             uuid.UUID
	ItemTreinoID         uuid.UUID
	NumeroSerie          int
	CargaRealizada       *float64
	RepeticoesRealizadas *int
	Concluida            bool
	ExecutadoEm          *time.Time
}

// SessaoComResumo é o read-model agregado para o histórico de sessões.
// Anexa ao SessaoTreino o nome/letra do treino (JOIN) e os contadores de
// séries totais/concluídas (subquery LATERAL — ver postgres_repository.go).
type SessaoComResumo struct {
	SessaoTreino
	TreinoLetra      string
	TreinoNome       string
	TotalSeries      int
	SeriesConcluidas int
}

// ItemBasico é a projeção mínima de ItemTreino usada pelo TreinoLookup
// para validar o numero_serie informado pelo cliente. Apenas ID e Series.
type ItemBasico struct {
	ID     uuid.UUID
	Series int
}
