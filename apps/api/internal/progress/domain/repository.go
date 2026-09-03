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

// AnamneseRepository persiste a anamnese com scoring de um aluno.
// aluno_id e UNIQUE no schema — Upsert cobre tanto o primeiro preenchimento
// quanto reavaliacoes futuras.
type AnamneseRepository interface {
	FindByAlunoID(ctx context.Context, alunoID uuid.UUID) (*Anamnese, error)
	Upsert(ctx context.Context, anamnese *Anamnese) error
}

// TemplateMatch e a projecao minima de um template de treino usada pela
// sugestao pos-anamnese — so o suficiente para o response e para acionar
// POST /fichas/from-template.
type TemplateMatch struct {
	ID   uuid.UUID
	Nome string
}

// TemplateMatcher e um port cross-context: Progress consulta o catalogo de
// templates (que vive no bounded context Training, junto de FichaTreino)
// sem importar o pacote Training — mesmo padrao de AccessRepository e do
// AlunoLookup de Training, para manter os contextos desacoplados.
type TemplateMatcher interface {
	// MelhorMatch devolve o melhor template para o nivel/objetivo apurados
	// na anamnese, priorizando templates custom do personal sobre os
	// globais do sistema. nil (sem erro) quando nao ha nenhum match.
	//
	// nivel e string (nao NivelAnamnese) deliberadamente — a implementacao
	// deste port mora em training/infrastructure, que assim nao precisa
	// importar progress/domain so por causa do tipo do enum.
	MelhorMatch(ctx context.Context, personalID uuid.UUID, nivel string, objetivo string) (*TemplateMatch, error)
}
