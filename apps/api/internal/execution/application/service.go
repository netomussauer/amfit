// Package application contém os casos de uso do contexto Execution.
package application

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/amfit/api/internal/execution/domain"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// dateLayout é o formato canônico de datas no contrato (ISO-8601 date-only).
const dateLayout = "2006-01-02"

// defaultPerPage limita a paginação quando o cliente não informa per_page
// — protege a API contra varreduras grandes.
const (
	defaultPerPage = 20
	maxPerPage     = 100
)

// AlunoLookup é o port de cross-context que permite ao Execution validar que
// um aluno pertence ao personal autenticado. Implementação SQL fica em
// infrastructure (mesma estratégia adotada pelo Training).
type AlunoLookup interface {
	BelongsToPersonal(ctx context.Context, alunoID, personalID uuid.UUID) (bool, error)
}

// ExecutionService implementa os casos de uso de execução de treino.
type ExecutionService struct {
	sessoes   domain.SessaoRepository
	registros domain.RegistroSerieRepository
	treinos   domain.TreinoLookup
	alunos    AlunoLookup
}

// NewExecutionService monta o service com as dependências fornecidas.
func NewExecutionService(
	sessoes domain.SessaoRepository,
	registros domain.RegistroSerieRepository,
	treinos domain.TreinoLookup,
	alunos AlunoLookup,
) *ExecutionService {
	return &ExecutionService{
		sessoes:   sessoes,
		registros: registros,
		treinos:   treinos,
		alunos:    alunos,
	}
}

// ── Sessões ────────────────────────────────────────────────────────────────

// IniciarSessao cria (ou retoma) a sessão EM_ANDAMENTO do dia para o aluno.
//
// Idempotência: se já existe sessão EM_ANDAMENTO hoje para o mesmo (aluno,
// treino), retornamos ela em vez de criar uma nova. Permite que o cliente
// chame "iniciar" sempre que abrir a tela de execução sem multiplicar linhas.
func (s *ExecutionService) IniciarSessao(
	ctx context.Context,
	alunoID uuid.UUID,
	req IniciarSessaoRequest,
) (*SessaoResponse, error) {
	treinoID, err := uuid.Parse(req.TreinoID)
	if err != nil {
		return nil, fmt.Errorf("application: parse treino_id: %w", err)
	}

	// Validar que o treino pertence à ficha ATIVA do aluno. Anti-enumeration
	// (não diferenciamos "não existe" de "não é seu" — handler devolve 404).
	ok, err := s.treinos.ValidarTreinoDoAluno(ctx, alunoID, treinoID)
	if err != nil {
		return nil, fmt.Errorf("application: validar treino do aluno: %w", err)
	}
	if !ok {
		return nil, domain.ErrTreinoInvalido
	}

	// Idempotência — se já existe sessão EM_ANDAMENTO hoje, devolve ela.
	existing, err := s.sessoes.FindEmAndamentoHoje(ctx, alunoID, treinoID)
	if err != nil && !errors.Is(err, domain.ErrSessaoNotFound) {
		return nil, fmt.Errorf("application: find sessão em andamento: %w", err)
	}
	if existing != nil {
		log.Info().
			Str("sessao_id", existing.ID.String()).
			Str("aluno_id", alunoID.String()).
			Str("treino_id", treinoID.String()).
			Msg("sessão EM_ANDAMENTO retomada (idempotência)")
		return s.buildSessaoResponse(ctx, existing)
	}

	now := time.Now().UTC()
	sessao := &domain.SessaoTreino{
		ID:           uuid.New(),
		AlunoID:      alunoID,
		TreinoID:     treinoID,
		DataExecucao: time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC),
		Status:       domain.StatusEmAndamento,
		IniciadoEm:   now,
	}

	if err := s.sessoes.Create(ctx, sessao); err != nil {
		return nil, fmt.Errorf("application: create sessão: %w", err)
	}

	log.Info().
		Str("sessao_id", sessao.ID.String()).
		Str("aluno_id", alunoID.String()).
		Str("treino_id", treinoID.String()).
		Msg("sessão iniciada")

	return s.buildSessaoResponse(ctx, sessao)
}

// BuscarSessao retorna a sessão com todas as séries já registradas. Aplica
// ownership: sessão de outro aluno → ErrSessaoForbidden (handler traduz 404).
func (s *ExecutionService) BuscarSessao(
	ctx context.Context,
	alunoID, sessaoID uuid.UUID,
) (*SessaoResponse, error) {
	sessao, err := s.requireSessaoOfAluno(ctx, sessaoID, alunoID)
	if err != nil {
		return nil, err
	}
	return s.buildSessaoResponse(ctx, sessao)
}

// RegistrarSerie insere ou atualiza um registro de série na sessão.
//
// Validações:
//   - ownership da sessão
//   - status == EM_ANDAMENTO (sessão concluída/abandonada não aceita updates)
//   - numero_serie <= total de séries do item (consultado via TreinoLookup)
//
// O Upsert é responsável pela idempotência da escrita: o cliente pode
// chamar PATCH várias vezes sobre a mesma série (corrigir carga, marcar
// concluída) sem violar a UNIQUE (sessao_id, item_treino_id, numero_serie).
func (s *ExecutionService) RegistrarSerie(
	ctx context.Context,
	alunoID, sessaoID uuid.UUID,
	req RegistrarSerieRequest,
) (*RegistroSerieResponse, error) {
	sessao, err := s.requireSessaoOfAluno(ctx, sessaoID, alunoID)
	if err != nil {
		return nil, err
	}
	if sessao.Status != domain.StatusEmAndamento {
		return nil, domain.ErrSessaoJaConcluida
	}

	itemID, err := uuid.Parse(req.ItemTreinoID)
	if err != nil {
		return nil, fmt.Errorf("application: parse item_treino_id: %w", err)
	}

	// Carrega itens do treino e valida se item_id pertence + numero_serie é
	// válido. Mantemos a leitura num só lookup para evitar 2 round-trips.
	_, _, itens, err := s.treinos.GetTreinoComItens(ctx, sessao.TreinoID)
	if err != nil {
		return nil, fmt.Errorf("application: get treino itens: %w", err)
	}
	var itemSeries int
	itemEncontrado := false
	for _, it := range itens {
		if it.ID == itemID {
			itemSeries = it.Series
			itemEncontrado = true
			break
		}
	}
	if !itemEncontrado {
		return nil, domain.ErrSerieInvalida
	}
	if req.NumeroSerie < 1 || req.NumeroSerie > itemSeries {
		return nil, domain.ErrSerieInvalida
	}

	registro := &domain.RegistroSerie{
		ID:                   uuid.New(),
		SessaoID:             sessaoID,
		ItemTreinoID:         itemID,
		NumeroSerie:          req.NumeroSerie,
		CargaRealizada:       req.CargaRealizada,
		RepeticoesRealizadas: req.RepeticoesRealizadas,
		Concluida:            req.Concluida,
	}
	if req.Concluida {
		now := time.Now().UTC()
		registro.ExecutadoEm = &now
	}

	if err := s.registros.Upsert(ctx, registro); err != nil {
		return nil, fmt.Errorf("application: upsert registro: %w", err)
	}

	log.Info().
		Str("sessao_id", sessaoID.String()).
		Str("aluno_id", alunoID.String()).
		Str("item_treino_id", itemID.String()).
		Int("numero_serie", req.NumeroSerie).
		Bool("concluida", req.Concluida).
		Msg("série registrada")

	resp := registroToResponse(registro)
	return &resp, nil
}

// ConcluirSessao marca a sessão como CONCLUIDO. Idempotente: se já estiver
// concluída, devolve o estado atual sem erro (não reescreve concluido_em).
func (s *ExecutionService) ConcluirSessao(
	ctx context.Context,
	alunoID, sessaoID uuid.UUID,
) (*SessaoResponse, error) {
	sessao, err := s.requireSessaoOfAluno(ctx, sessaoID, alunoID)
	if err != nil {
		return nil, err
	}

	if sessao.Status == domain.StatusConcluido {
		// Idempotência: já está concluída, devolve como está.
		return s.buildSessaoResponse(ctx, sessao)
	}

	now := time.Now().UTC()
	if err := s.sessoes.UpdateStatus(ctx, sessaoID, domain.StatusConcluido, &now); err != nil {
		// O repositório é responsável pela "concorrência segura": o UPDATE
		// usa WHERE status='EM_ANDAMENTO' — se outro processo concluir
		// antes, o RowsAffected vem 0 e o repo recarrega o estado e
		// devolve nil quando já estiver CONCLUIDO (idempotência).
		return nil, fmt.Errorf("application: concluir sessão: %w", err)
	}
	// Recarrega para refletir o concluido_em final (importante quando
	// houver concorrência: outro processo pode ter concluído antes e o
	// "now" desta goroutine não bate com o concluido_em persistido).
	sessao, err = s.sessoes.FindByID(ctx, sessaoID)
	if err != nil {
		return nil, fmt.Errorf("application: reload sessão pós-conclusão: %w", err)
	}

	log.Info().
		Str("sessao_id", sessaoID.String()).
		Str("aluno_id", alunoID.String()).
		Str("treino_id", sessao.TreinoID.String()).
		Msg("sessão concluída")

	return s.buildSessaoResponse(ctx, sessao)
}

// ListarMinhasSessoes devolve o histórico paginado do aluno autenticado.
func (s *ExecutionService) ListarMinhasSessoes(
	ctx context.Context,
	alunoID uuid.UUID,
	page, perPage int,
) (*SessaoListResponse, error) {
	page, perPage = normalizePagination(page, perPage)

	rows, total, err := s.sessoes.ListByAluno(ctx, alunoID, page, perPage)
	if err != nil {
		return nil, fmt.Errorf("application: list sessões aluno: %w", err)
	}

	out := make([]SessaoResumoResponse, 0, len(rows))
	for _, r := range rows {
		out = append(out, resumoToResponse(r))
	}
	return &SessaoListResponse{
		Data: out,
		Pagination: Pagination{
			Total:   total,
			Page:    page,
			PerPage: perPage,
		},
	}, nil
}

// ListarSessoesDoAluno é a versão para o personal: valida ownership do aluno
// (aluno pertence ao personal autenticado) e então lista o histórico.
func (s *ExecutionService) ListarSessoesDoAluno(
	ctx context.Context,
	personalID, alunoID uuid.UUID,
	page, perPage int,
) (*SessaoListResponse, error) {
	owns, err := s.alunos.BelongsToPersonal(ctx, alunoID, personalID)
	if err != nil {
		return nil, fmt.Errorf("application: verificar ownership do aluno: %w", err)
	}
	if !owns {
		// 404 anti-enumeration — não distinguimos "aluno não existe" de
		// "aluno é de outro personal".
		return nil, domain.ErrSessaoForbidden
	}

	return s.ListarMinhasSessoes(ctx, alunoID, page, perPage)
}

// ── Helpers ────────────────────────────────────────────────────────────────

// requireSessaoOfAluno carrega a sessão e valida ownership. Quando a sessão
// não existe ou pertence a outro aluno, mapeia para ErrSessaoForbidden — o
// handler devolve 404 idêntico (anti-enumeration).
func (s *ExecutionService) requireSessaoOfAluno(
	ctx context.Context,
	sessaoID, alunoID uuid.UUID,
) (*domain.SessaoTreino, error) {
	sessao, err := s.sessoes.FindByID(ctx, sessaoID)
	if err != nil {
		if errors.Is(err, domain.ErrSessaoNotFound) {
			return nil, err
		}
		return nil, fmt.Errorf("application: find sessão: %w", err)
	}
	if sessao.AlunoID != alunoID {
		return nil, domain.ErrSessaoForbidden
	}
	return sessao, nil
}

// buildSessaoResponse monta o DTO completo (sessão + séries). Faz uma 2ª
// query para ListBySessao — separar mantém o read-model simples e o índice
// idx_registro_item_sessao adequado.
func (s *ExecutionService) buildSessaoResponse(
	ctx context.Context,
	sessao *domain.SessaoTreino,
) (*SessaoResponse, error) {
	registros, err := s.registros.ListBySessao(ctx, sessao.ID)
	if err != nil {
		return nil, fmt.Errorf("application: list registros: %w", err)
	}

	series := make([]RegistroSerieResponse, 0, len(registros))
	for _, r := range registros {
		series = append(series, registroToResponse(r))
	}

	resp := SessaoResponse{
		ID:           sessao.ID.String(),
		TreinoID:     sessao.TreinoID.String(),
		DataExecucao: sessao.DataExecucao.Format(dateLayout),
		Status:       string(sessao.Status),
		IniciadoEm:   sessao.IniciadoEm,
		ConcluidoEm:  sessao.ConcluidoEm,
		Series:       series,
	}
	return &resp, nil
}

// normalizePagination aplica defaults e teto.
func normalizePagination(page, perPage int) (int, int) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = defaultPerPage
	}
	if perPage > maxPerPage {
		perPage = maxPerPage
	}
	return page, perPage
}

// ── Mappers ────────────────────────────────────────────────────────────────

func registroToResponse(r *domain.RegistroSerie) RegistroSerieResponse {
	return RegistroSerieResponse{
		ID:                   r.ID.String(),
		ItemTreinoID:         r.ItemTreinoID.String(),
		NumeroSerie:          r.NumeroSerie,
		Concluida:            r.Concluida,
		CargaRealizada:       r.CargaRealizada,
		RepeticoesRealizadas: r.RepeticoesRealizadas,
		ExecutadoEm:          r.ExecutadoEm,
	}
}

func resumoToResponse(r *domain.SessaoComResumo) SessaoResumoResponse {
	return SessaoResumoResponse{
		ID:               r.ID.String(),
		TreinoID:         r.TreinoID.String(),
		TreinoLetra:      r.TreinoLetra,
		TreinoNome:       r.TreinoNome,
		DataExecucao:     r.DataExecucao.Format(dateLayout),
		Status:           string(r.Status),
		IniciadoEm:       r.IniciadoEm,
		ConcluidoEm:      r.ConcluidoEm,
		TotalSeries:      r.TotalSeries,
		SeriesConcluidas: r.SeriesConcluidas,
	}
}
