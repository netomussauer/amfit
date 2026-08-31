// Package domain define as entidades e tipos do contexto Progress.
package domain

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

// MedidaCorporal registra dados antropometricos de um aluno em uma data.
// (Stub para fase 2 — CRUD nao implementado nesta entrega.)
type MedidaCorporal struct {
	ID              uuid.UUID
	AlunoID         uuid.UUID
	DataMedicao     time.Time
	PesoKg          *float64
	AlturaCm        *float64
	GorduraPct      *float64
	MassaMagraKg    *float64
	Circunferencias json.RawMessage
	Observacao      *string
}

// Anamnese registra o historico clinico inicial do aluno.
// (Stub para fase 2 — CRUD nao implementado nesta entrega.)
type Anamnese struct {
	ID             uuid.UUID
	AlunoID        uuid.UUID
	Objetivos      string
	HistoricoSaude string
	Lesoes         string
	Medicamentos   string
	NivelAtividade string
	CriadoEm       time.Time
	AtualizadoEm   time.Time
}

// HistoricoCargaPonto representa um ponto da serie temporal de carga
// realizada em um exercicio para um aluno. Um ponto = uma serie executada
// em uma sessao concluida.
type HistoricoCargaPonto struct {
	SessaoID             uuid.UUID
	DataExecucao         time.Time // somente a parte data
	NumeroSerie          int
	CargaRealizada       *float64
	RepeticoesRealizadas *int
}

// HistoricoCargaExercicio agrega os pontos de historico de um exercicio
// para um aluno. Util para o frontend renderizar grafico de evolucao.
type HistoricoCargaExercicio struct {
	AlunoID     uuid.UUID
	ExercicioID uuid.UUID
	Pontos      []HistoricoCargaPonto
}

// DashboardResumo agrega contadores e listas resumidas para o personal.
// Calculado em tempo real (sem cache) na primeira versao — sub-1s para
// portfolios tipicos do MVP. Migrar para materialized view quando
// necessario.
type DashboardResumo struct {
	PersonalID           uuid.UUID
	AlunosAtivos         int
	FichasAtivas         int
	SessoesUltimos7Dias  int
	SessoesUltimos30Dias int
	AlunosSemSessao7Dias int
}

// ErrExercicioNotFound indica que o exercicio nao existe ou nao pertence
// ao escopo de visibilidade do solicitante (global ou do mesmo personal).
var ErrExercicioNotFound = errors.New("progress: exercicio nao encontrado")

// ErrAlunoNotFound indica que o aluno nao existe ou nao pertence ao
// personal autenticado (quando aplicavel).
var ErrAlunoNotFound = errors.New("progress: aluno nao encontrado")

// ErrRepositorioNaoConfigurado indica que o ProgressService foi construido
// sem o repositorio necessario para a operacao (historico ou dashboard).
// NewProgressService documenta aceitar nil durante o scaffolding — este
// erro e o que efetivamente cumpre essa promessa (achado de code-review:
// antes disso, chamar a operacao com o repositorio nil causava panic em
// vez do erro gracioso que o doc comment prometia).
var ErrRepositorioNaoConfigurado = errors.New("progress: repositorio nao configurado")
