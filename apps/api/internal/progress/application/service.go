// Package application contém os casos de uso do contexto Progress.
package application

import (
	"context"
	"time"

	"github.com/amfit/api/internal/progress/domain"
	"github.com/google/uuid"
)

const (
	// historicoLimitDefault e o teto de pontos devolvido por requisicao.
	// Em portfolios tipicos do MVP (1-2 treinos/semana, ~3 series cada)
	// 500 pontos cobrem >1 ano de historico.
	historicoLimitDefault = 500

	// historicoIntervaloPadrao e a janela default quando o caller nao
	// passa from/to: ultimos 12 meses.
	historicoIntervaloPadrao = 365 * 24 * time.Hour
)

// ProgressService agrupa os casos de uso de acompanhamento de evolucao.
type ProgressService struct {
	historico domain.HistoricoQueryRepository
	dashboard domain.DashboardQueryRepository
	access    domain.AccessRepository
}

// NewProgressService monta o servico com as dependencias necessarias.
// Pode receber nil para historico/dashboard/access — nesse caso os
// metodos correspondentes retornarao erro de operacao nao suportada.
// Util durante o scaffolding inicial enquanto repos sao plumbados.
func NewProgressService(
	historico domain.HistoricoQueryRepository,
	dashboard domain.DashboardQueryRepository,
	access domain.AccessRepository,
) *ProgressService {
	return &ProgressService{
		historico: historico,
		dashboard: dashboard,
		access:    access,
	}
}

// HistoricoParams agrupa os filtros opcionais para uma consulta de
// historico de carga.
type HistoricoParams struct {
	From  *time.Time
	To    *time.Time
	Limit *int
}

func (p HistoricoParams) resolveFrom(now time.Time) time.Time {
	if p.From != nil {
		return *p.From
	}
	return now.Add(-historicoIntervaloPadrao)
}

func (p HistoricoParams) resolveTo(now time.Time) time.Time {
	if p.To != nil {
		return *p.To
	}
	return now
}

func (p HistoricoParams) resolveLimit() int {
	if p.Limit != nil && *p.Limit > 0 && *p.Limit <= historicoLimitDefault {
		return *p.Limit
	}
	return historicoLimitDefault
}

// HistoricoDoAlunoLogado devolve a serie de cargas do aluno autenticado
// (role=ALUNO usando o proprio sub do JWT).
func (s *ProgressService) HistoricoDoAlunoLogado(
	ctx context.Context,
	alunoID uuid.UUID,
	exercicioID uuid.UUID,
	params HistoricoParams,
) (domain.HistoricoCargaExercicio, error) {
	if s.access != nil {
		if err := s.access.ExercicioVisivelParaAluno(ctx, alunoID, exercicioID); err != nil {
			return domain.HistoricoCargaExercicio{}, err
		}
	}
	return s.historicoCore(ctx, alunoID, exercicioID, params)
}

// HistoricoDoAlunoVistoPelorPersonal devolve a serie de cargas para um
// aluno especifico, garantindo que ele pertence ao personal solicitante.
func (s *ProgressService) HistoricoDoAlunoVistoPeloPersonal(
	ctx context.Context,
	personalID uuid.UUID,
	alunoID uuid.UUID,
	exercicioID uuid.UUID,
	params HistoricoParams,
) (domain.HistoricoCargaExercicio, error) {
	if s.access != nil {
		if err := s.access.AlunoExisteEPertenceAoPersonal(ctx, personalID, alunoID); err != nil {
			return domain.HistoricoCargaExercicio{}, err
		}
		if err := s.access.ExercicioVisivelParaPersonal(ctx, personalID, exercicioID); err != nil {
			return domain.HistoricoCargaExercicio{}, err
		}
	}
	return s.historicoCore(ctx, alunoID, exercicioID, params)
}

func (s *ProgressService) historicoCore(
	ctx context.Context,
	alunoID, exercicioID uuid.UUID,
	params HistoricoParams,
) (domain.HistoricoCargaExercicio, error) {
	now := time.Now().UTC()
	pontos, err := s.historico.HistoricoCarga(
		ctx, alunoID, exercicioID,
		params.resolveFrom(now), params.resolveTo(now),
		params.resolveLimit(),
	)
	if err != nil {
		return domain.HistoricoCargaExercicio{}, err
	}
	return domain.HistoricoCargaExercicio{
		AlunoID:     alunoID,
		ExercicioID: exercicioID,
		Pontos:      pontos,
	}, nil
}

// Dashboard devolve o resumo agregado para o personal autenticado.
func (s *ProgressService) Dashboard(
	ctx context.Context,
	personalID uuid.UUID,
) (domain.DashboardResumo, error) {
	return s.dashboard.Resumo(ctx, personalID)
}
