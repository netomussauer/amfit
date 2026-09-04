package domain

import (
	"context"

	"github.com/google/uuid"
)

// PlanoAlunoRepository persiste PlanoAluno.
type PlanoAlunoRepository interface {
	Create(ctx context.Context, p *PlanoAluno) error
	FindByID(ctx context.Context, id uuid.UUID) (*PlanoAluno, error)

	// FindAtivoByAluno devolve o plano ATIVO do aluno, se existir. Devolve
	// (nil, nil) quando não há nenhum — não é um erro, é o estado normal de
	// um aluno sem plano configurado ainda.
	FindAtivoByAluno(ctx context.Context, alunoID uuid.UUID) (*PlanoAluno, error)

	Update(ctx context.Context, p *PlanoAluno) error

	// ListarAtivosParaGeracao devolve todos os planos ATIVO com vigência
	// corrente — consumido só pelo worker (GerarMensalidadesDoMes).
	ListarAtivosParaGeracao(ctx context.Context) ([]*PlanoAluno, error)
}

// ListarMensalidadesParams filtra GET /mensalidades (personal) e
// GET /alunos/me/mensalidades (aluno).
type ListarMensalidadesParams struct {
	AlunoID        *uuid.UUID
	Status         *StatusMensalidade
	CompetenciaAno *int
	CompetenciaMes *int
	Page           int
	PerPage        int
}

// DashboardFinanceiro resume a situação financeira do personal — usado no
// GET /financeiro/dashboard.
type DashboardFinanceiro struct {
	PendentesQtd    int
	PendentesValor  float64
	AtrasadasQtd    int
	AtrasadasValor  float64
	ReceitaMesAtual float64
	Inadimplentes   []AlunoInadimplente
}

// AlunoInadimplente resume a situação de atraso de um aluno específico.
type AlunoInadimplente struct {
	AlunoID            uuid.UUID
	Nome               string
	QtdAtrasadas       int
	ValorTotalAtrasado float64
}

// MensalidadeRepository persiste Mensalidade e resolve as consultas
// agregadas do dashboard financeiro.
type MensalidadeRepository interface {
	FindByID(ctx context.Context, id uuid.UUID) (*Mensalidade, error)
	Update(ctx context.Context, m *Mensalidade) error

	// ListByPersonal devolve as mensalidades dos alunos do personal,
	// paginadas e filtradas por ListarMensalidadesParams.
	ListByPersonal(ctx context.Context, personalID uuid.UUID, params ListarMensalidadesParams) ([]*Mensalidade, int, error)

	// ListByAluno devolve as mensalidades do próprio aluno autenticado.
	ListByAluno(ctx context.Context, alunoID uuid.UUID, params ListarMensalidadesParams) ([]*Mensalidade, int, error)

	Dashboard(ctx context.Context, personalID uuid.UUID) (*DashboardFinanceiro, error)

	// ── Consumidas só pelo worker (internal/financial/worker) ──────────────

	// GerarPendentes cria, de forma idempotente, a mensalidade da
	// competência corrente para cada plano ATIVO que ainda não tem uma —
	// devolve quantas foram geradas.
	GerarPendentes(ctx context.Context) (int, error)

	// MarcarAtrasadas move PENDENTE → ATRASADA para mensalidades vencidas —
	// devolve quantas foram afetadas.
	MarcarAtrasadas(ctx context.Context) (int, error)

	// ListarParaLembrete devolve mensalidades PENDENTE dentro da janela de
	// lembrete (vencimento em até 3 dias) que ainda não foram avisadas.
	ListarParaLembrete(ctx context.Context, limit int) ([]*Mensalidade, error)
	MarcarLembreteEnviado(ctx context.Context, id uuid.UUID) error
}
