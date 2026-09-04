// Package application contém os casos de uso do contexto Financial.
package application

import (
	"context"
	"fmt"
	"time"

	"github.com/amfit/api/internal/financial/domain"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// dateLayout é o formato canônico de datas no contrato (ISO-8601 date-only)
// — mesma convenção usada nos demais contextos (ver execution/application).
const dateLayout = "2006-01-02"

const (
	defaultPerPage = 20
	maxPerPage     = 100
)

// AlunoLookup é o port de cross-context com o Identity — mesmo padrão já
// usado em Execution/Training/Progress (cada contexto tem sua própria
// implementação SQL em infrastructure, sem importar o pacote do Identity).
type AlunoLookup interface {
	BelongsToPersonal(ctx context.Context, alunoID, personalID uuid.UUID) (bool, error)
}

// Notifier é o port de cross-context com o Notification. Sem barramento de
// eventos (mesma estratégia do Execution) — o service chama esse port
// diretamente; falha de notificação nunca reverte nem falha o caso de uso
// principal, é só um efeito colateral.
type Notifier interface {
	NotificarMensalidadePaga(ctx context.Context, alunoID uuid.UUID, competencia string, valor float64) error
	NotificarMensalidadeVencendo(ctx context.Context, alunoID uuid.UUID, diasRestantes int, valor float64) error
}

// FinancialService implementa os casos de uso de plano e mensalidades.
type FinancialService struct {
	planos       domain.PlanoAlunoRepository
	mensalidades domain.MensalidadeRepository
	alunos       AlunoLookup
	notifier     Notifier
}

// NewFinancialService monta o service com as dependências fornecidas.
func NewFinancialService(
	planos domain.PlanoAlunoRepository,
	mensalidades domain.MensalidadeRepository,
	alunos AlunoLookup,
	notifier Notifier,
) *FinancialService {
	return &FinancialService{
		planos:       planos,
		mensalidades: mensalidades,
		alunos:       alunos,
		notifier:     notifier,
	}
}

// ── Plano ────────────────────────────────────────────────────────────────

// ConfigurarPlano cria o plano de um aluno (POST /alunos/{id}/plano). Falha
// com ErrPlanoJaAtivo se o aluno já tiver um plano ATIVO — o personal deve
// usar AtualizarPlano nesse caso.
func (s *FinancialService) ConfigurarPlano(
	ctx context.Context,
	personalID, alunoID uuid.UUID,
	req CriarPlanoRequest,
) (*PlanoResponse, error) {
	pertence, err := s.alunos.BelongsToPersonal(ctx, alunoID, personalID)
	if err != nil {
		return nil, fmt.Errorf("application: verificar aluno: %w", err)
	}
	if !pertence {
		return nil, domain.ErrPlanoNaoEncontrado
	}

	existente, err := s.planos.FindAtivoByAluno(ctx, alunoID)
	if err != nil {
		return nil, fmt.Errorf("application: buscar plano ativo: %w", err)
	}
	if existente != nil {
		return nil, domain.ErrPlanoJaAtivo
	}

	vigenciaInicio := time.Now().UTC().Truncate(24 * time.Hour)
	if req.VigenciaInicio != "" {
		vigenciaInicio, err = time.Parse(dateLayout, req.VigenciaInicio)
		if err != nil {
			return nil, fmt.Errorf("application: vigencia_inicio invalida: %w", err)
		}
	}

	p := &domain.PlanoAluno{
		ID:             uuid.New(),
		AlunoID:        alunoID,
		PersonalID:     personalID,
		ValorMensal:    req.ValorMensal,
		DiaVencimento:  req.DiaVencimento,
		VigenciaInicio: vigenciaInicio,
		Status:         domain.StatusPlanoAtivo,
		Observacao:     req.Observacao,
	}
	if err := s.planos.Create(ctx, p); err != nil {
		return nil, fmt.Errorf("application: criar plano: %w", err)
	}
	resp := toPlanoResponse(p)
	return &resp, nil
}

// ObterMeuPlanoAtivo devolve o plano ATIVO do aluno autenticado
// (GET /alunos/me/plano) — sem checagem de posse, o alunoID já vem do JWT.
func (s *FinancialService) ObterMeuPlanoAtivo(ctx context.Context, alunoID uuid.UUID) (*PlanoResponse, error) {
	return s.obterPlanoAtivo(ctx, alunoID)
}

// ObterPlanoDoAluno devolve o plano ATIVO de um aluno específico
// (GET /alunos/{id}/plano) — confirma antes, via AlunoLookup, que o aluno
// pertence ao personal autenticado.
func (s *FinancialService) ObterPlanoDoAluno(ctx context.Context, personalID, alunoID uuid.UUID) (*PlanoResponse, error) {
	pertence, err := s.alunos.BelongsToPersonal(ctx, alunoID, personalID)
	if err != nil {
		return nil, fmt.Errorf("application: verificar aluno: %w", err)
	}
	if !pertence {
		return nil, domain.ErrPlanoNaoEncontrado
	}
	return s.obterPlanoAtivo(ctx, alunoID)
}

func (s *FinancialService) obterPlanoAtivo(ctx context.Context, alunoID uuid.UUID) (*PlanoResponse, error) {
	p, err := s.planos.FindAtivoByAluno(ctx, alunoID)
	if err != nil {
		return nil, fmt.Errorf("application: buscar plano ativo: %w", err)
	}
	if p == nil {
		return nil, domain.ErrPlanoNaoEncontrado
	}
	resp := toPlanoResponse(p)
	return &resp, nil
}

// AtualizarPlano aplica um patch parcial sobre um plano existente
// (PATCH /planos/{id}).
func (s *FinancialService) AtualizarPlano(
	ctx context.Context,
	personalID, planoID uuid.UUID,
	req AtualizarPlanoRequest,
) (*PlanoResponse, error) {
	p, err := s.planos.FindByID(ctx, planoID)
	if err != nil {
		return nil, fmt.Errorf("application: buscar plano: %w", err)
	}
	if p == nil || p.PersonalID != personalID {
		return nil, domain.ErrPlanoNaoEncontrado
	}

	if req.ValorMensal != nil {
		p.ValorMensal = *req.ValorMensal
	}
	if req.DiaVencimento != nil {
		p.DiaVencimento = *req.DiaVencimento
	}
	if req.VigenciaFim != nil {
		if *req.VigenciaFim == "" {
			p.VigenciaFim = nil
		} else {
			fim, err := time.Parse(dateLayout, *req.VigenciaFim)
			if err != nil {
				return nil, fmt.Errorf("application: vigencia_fim invalida: %w", err)
			}
			p.VigenciaFim = &fim
		}
	}
	if req.Status != nil {
		p.Status = domain.StatusPlano(*req.Status)
	}
	if req.Observacao != nil {
		p.Observacao = *req.Observacao
	}

	if err := s.planos.Update(ctx, p); err != nil {
		return nil, fmt.Errorf("application: atualizar plano: %w", err)
	}
	resp := toPlanoResponse(p)
	return &resp, nil
}

// ── Mensalidades ─────────────────────────────────────────────────────────

// ListarMensalidadesDoPersonal lista as mensalidades dos alunos do personal
// (GET /mensalidades).
func (s *FinancialService) ListarMensalidadesDoPersonal(
	ctx context.Context,
	personalID uuid.UUID,
	req ListarMensalidadesRequest,
) (*MensalidadeListResponse, error) {
	params, err := toRepoParams(req)
	if err != nil {
		return nil, err
	}
	mensalidades, total, err := s.mensalidades.ListByPersonal(ctx, personalID, params)
	if err != nil {
		return nil, fmt.Errorf("application: listar mensalidades: %w", err)
	}
	return toMensalidadeListResponse(mensalidades, total, params), nil
}

// ListarMinhasMensalidades lista as mensalidades do próprio aluno
// autenticado (GET /alunos/me/mensalidades).
func (s *FinancialService) ListarMinhasMensalidades(
	ctx context.Context,
	alunoID uuid.UUID,
	req ListarMensalidadesRequest,
) (*MensalidadeListResponse, error) {
	params, err := toRepoParams(req)
	if err != nil {
		return nil, err
	}
	mensalidades, total, err := s.mensalidades.ListByAluno(ctx, alunoID, params)
	if err != nil {
		return nil, fmt.Errorf("application: listar minhas mensalidades: %w", err)
	}
	return toMensalidadeListResponse(mensalidades, total, params), nil
}

// MarcarPaga registra o pagamento manual de uma mensalidade
// (PATCH /mensalidades/{id}/marcar-paga) e notifica o aluno.
func (s *FinancialService) MarcarPaga(
	ctx context.Context,
	personalID, mensalidadeID uuid.UUID,
	req MarcarPagaRequest,
) (*MensalidadeResponse, error) {
	m, err := s.buscarMensalidadeDoPersonal(ctx, personalID, mensalidadeID)
	if err != nil {
		return nil, err
	}
	if m.Status == domain.StatusMensalidadePaga {
		return nil, domain.ErrMensalidadeJaPaga
	}
	if m.Status == domain.StatusMensalidadeCancelada || m.Status == domain.StatusMensalidadeIsenta {
		return nil, domain.ErrStatusMensalidadeInvalido
	}

	valorPago := m.Valor
	if req.ValorPago != nil {
		valorPago = *req.ValorPago
	}
	dataPagamento := time.Now().UTC().Truncate(24 * time.Hour)
	if req.DataPagamento != nil {
		dataPagamento, err = time.Parse(dateLayout, *req.DataPagamento)
		if err != nil {
			return nil, fmt.Errorf("application: data_pagamento invalida: %w", err)
		}
	}
	forma := domain.FormaPagamento(req.FormaPagamento)

	m.Status = domain.StatusMensalidadePaga
	m.ValorPago = &valorPago
	m.DataPagamento = &dataPagamento
	m.FormaPagamento = &forma
	if req.Observacao != "" {
		m.Observacao = req.Observacao
	}

	if err := s.mensalidades.Update(ctx, m); err != nil {
		return nil, fmt.Errorf("application: marcar mensalidade paga: %w", err)
	}

	// Efeito colateral — nunca falha o caso de uso principal. Notifica o
	// ALUNO (não o personal, como no fluxo de webhook do SDD) porque aqui
	// quem confirma o pagamento é o próprio personal, manualmente.
	competencia := fmt.Sprintf("%02d/%d", m.CompetenciaMes, m.CompetenciaAno)
	if err := s.notifier.NotificarMensalidadePaga(ctx, m.AlunoID, competencia, valorPago); err != nil {
		log.Error().Err(err).Str("mensalidade_id", m.ID.String()).Msg("financial: falha ao notificar mensalidade paga")
	}

	resp := toMensalidadeResponse(m)
	return &resp, nil
}

// AtualizarStatusMensalidade cancela ou isenta uma mensalidade
// (PATCH /mensalidades/{id}).
func (s *FinancialService) AtualizarStatusMensalidade(
	ctx context.Context,
	personalID, mensalidadeID uuid.UUID,
	req AtualizarStatusMensalidadeRequest,
) (*MensalidadeResponse, error) {
	m, err := s.buscarMensalidadeDoPersonal(ctx, personalID, mensalidadeID)
	if err != nil {
		return nil, err
	}
	if m.Status == domain.StatusMensalidadePaga {
		return nil, domain.ErrStatusMensalidadeInvalido
	}

	m.Status = domain.StatusMensalidade(req.Status)
	if req.Observacao != "" {
		m.Observacao = req.Observacao
	}
	if err := s.mensalidades.Update(ctx, m); err != nil {
		return nil, fmt.Errorf("application: atualizar status mensalidade: %w", err)
	}
	resp := toMensalidadeResponse(m)
	return &resp, nil
}

// buscarMensalidadeDoPersonal resolve a mensalidade e confirma, via
// AlunoLookup, que o aluno dono dela pertence ao personal autenticado —
// evita que um personal opere sobre a mensalidade de outro.
func (s *FinancialService) buscarMensalidadeDoPersonal(
	ctx context.Context,
	personalID, mensalidadeID uuid.UUID,
) (*domain.Mensalidade, error) {
	m, err := s.mensalidades.FindByID(ctx, mensalidadeID)
	if err != nil {
		return nil, fmt.Errorf("application: buscar mensalidade: %w", err)
	}
	if m == nil {
		return nil, domain.ErrMensalidadeNaoEncontrada
	}
	pertence, err := s.alunos.BelongsToPersonal(ctx, m.AlunoID, personalID)
	if err != nil {
		return nil, fmt.Errorf("application: verificar aluno: %w", err)
	}
	if !pertence {
		return nil, domain.ErrMensalidadeNaoEncontrada
	}
	return m, nil
}

// ── Dashboard ────────────────────────────────────────────────────────────

// Dashboard resume a situação financeira do personal (GET /financeiro/dashboard).
func (s *FinancialService) Dashboard(ctx context.Context, personalID uuid.UUID) (*DashboardFinanceiroResponse, error) {
	d, err := s.mensalidades.Dashboard(ctx, personalID)
	if err != nil {
		return nil, fmt.Errorf("application: dashboard financeiro: %w", err)
	}
	return toDashboardResponse(d), nil
}

// ── Jobs consumidos pelo worker (internal/financial/worker) ─────────────

// GerarMensalidadesDoMes garante, de forma idempotente, que cada plano
// ATIVO tenha uma mensalidade para a competência corrente.
func (s *FinancialService) GerarMensalidadesDoMes(ctx context.Context) (int, error) {
	n, err := s.mensalidades.GerarPendentes(ctx)
	if err != nil {
		return 0, fmt.Errorf("application: gerar mensalidades do mes: %w", err)
	}
	return n, nil
}

// MarcarMensalidadesAtrasadas move PENDENTE → ATRASADA para mensalidades
// vencidas.
func (s *FinancialService) MarcarMensalidadesAtrasadas(ctx context.Context) (int, error) {
	n, err := s.mensalidades.MarcarAtrasadas(ctx)
	if err != nil {
		return 0, fmt.Errorf("application: marcar mensalidades atrasadas: %w", err)
	}
	return n, nil
}

// EnviarLembretesVencimento notifica o aluno de cada mensalidade que entrou
// na janela de lembrete (ver janelaLembreteDias) e ainda não foi avisada.
func (s *FinancialService) EnviarLembretesVencimento(ctx context.Context, limit int) (int, error) {
	elegiveis, err := s.mensalidades.ListarParaLembrete(ctx, limit)
	if err != nil {
		return 0, fmt.Errorf("application: listar mensalidades para lembrete: %w", err)
	}

	enviados := 0
	hoje := time.Now().UTC().Truncate(24 * time.Hour)
	for _, m := range elegiveis {
		diasRestantes := int(m.DataVencimento.Sub(hoje).Hours() / 24)
		if err := s.notifier.NotificarMensalidadeVencendo(ctx, m.AlunoID, diasRestantes, m.Valor); err != nil {
			log.Error().Err(err).Str("mensalidade_id", m.ID.String()).Msg("financial: falha ao notificar mensalidade vencendo")
			continue
		}
		if err := s.mensalidades.MarcarLembreteEnviado(ctx, m.ID); err != nil {
			log.Error().Err(err).Str("mensalidade_id", m.ID.String()).Msg("financial: falha ao marcar lembrete enviado")
			continue
		}
		enviados++
	}
	return enviados, nil
}
