// Package domain define as entidades e tipos do contexto Progress.
package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// MedidaCorporal registra dados antropométricos de um aluno em uma data.
type MedidaCorporal struct {
	ID               uuid.UUID
	AlunoID          uuid.UUID
	DataMedicao      time.Time
	PesoKg           *float64
	AlturaCm         *float64
	GorduraPct       *float64
	MassaMagraKg     *float64
	Circunferencias  json.RawMessage
	Observacao       *string
}

// Anamnese registra o histórico clínico inicial do aluno.
type Anamnese struct {
	ID             uuid.UUID
	AlunoID        uuid.UUID
	Objetivos      string
	HistoricoSaude string
	Lesoes         string
	Medicamentos   string
	NivelAtividade string
	CriadoEm      time.Time
	AtualizadoEm  time.Time
}
