package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// HistoricoQueryRepository expoe consultas read-only que cruzam os
// contextos Execution + Training para montar series temporais de carga
// realizada por exercicio. Implementacao usa o mesmo pool PostgreSQL
// do Execution context — a separacao e logica (visao de leitura), nao
// fisica.
type HistoricoQueryRepository interface {
	// HistoricoCarga devolve as series concluidas para `exercicioID` do
	// aluno `alunoID`, restritas ao intervalo [from, to] (inclusive).
	// Apenas sessoes com status=CONCLUIDA entram. Limit limita o numero
	// de pontos retornados (mais recentes primeiro quando excedido).
	HistoricoCarga(
		ctx context.Context,
		alunoID uuid.UUID,
		exercicioID uuid.UUID,
		from time.Time,
		to time.Time,
		limit int,
	) ([]HistoricoCargaPonto, error)
}

// DashboardQueryRepository expoe consultas agregadas para o dashboard do
// personal. Retornos sao snapshots — nao sao reativos.
type DashboardQueryRepository interface {
	// Resumo agrega contadores principais para um personal trainer.
	Resumo(ctx context.Context, personalID uuid.UUID) (DashboardResumo, error)
}

// AccessRepository valida visibilidade cross-context: se o personal pode
// ver o aluno e se o exercicio existe no escopo (global ou do mesmo
// personal). Mantemos as queries aqui (no Progress) ao inves de chamar
// Identity/Catalog services para evitar coupling — sao 2 SELECTs leves.
type AccessRepository interface {
	// AlunoExisteEPertenceAoPersonal devolve nil se o aluno existe e
	// pertence ao personal informado. Retorna ErrAlunoNotFound caso
	// contrario (sem distinguir "nao existe" de "nao seu" — anti-enum).
	AlunoExisteEPertenceAoPersonal(ctx context.Context, personalID, alunoID uuid.UUID) error

	// ExercicioVisivelParaPersonal devolve nil se o exercicio existe e
	// e global ou pertence ao personal. ErrExercicioNotFound caso
	// contrario.
	ExercicioVisivelParaPersonal(ctx context.Context, personalID, exercicioID uuid.UUID) error

	// ExercicioVisivelParaAluno devolve nil se o exercicio existe e e
	// global ou pertence ao personal do aluno.
	ExercicioVisivelParaAluno(ctx context.Context, alunoID, exercicioID uuid.UUID) error
}

// MedidaCorporalRepository — stub para fase 2 (mantido por compat).
type MedidaCorporalRepository interface {
	FindByAlunoID(ctx context.Context, alunoID uuid.UUID, from, to time.Time) ([]*MedidaCorporal, error)
	Save(ctx context.Context, medida *MedidaCorporal) error
}

// AnamneseRepository — stub para fase 2 (mantido por compat).
type AnamneseRepository interface {
	FindByAlunoID(ctx context.Context, alunoID uuid.UUID) (*Anamnese, error)
	Save(ctx context.Context, anamnese *Anamnese) error
}
