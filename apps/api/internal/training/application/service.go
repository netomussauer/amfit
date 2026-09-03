// Package application contém os casos de uso do contexto Training.
package application

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/amfit/api/internal/training/domain"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// dateLayout é o formato canônico de datas no contrato (ISO-8601 date-only).
const dateLayout = "2006-01-02"

// AlunoLookup abstrai a verificação de ownership "aluno pertence ao personal".
//
// É um port próprio (e não uma dependência direta de identity.AlunoRepository)
// para manter os bounded contexts desacoplados — Training não importa nada de
// Identity. O wiring em main.go injeta uma implementação que faz a query
// direta na tabela aluno (LEIA o comentário em postgres_repository.go).
type AlunoLookup interface {
	BelongsToPersonal(ctx context.Context, alunoID, personalID uuid.UUID) (bool, error)
}

// TrainingService implementa os casos de uso de gestão de fichas de treino.
type TrainingService struct {
	fichas       domain.FichaRepository
	treinos      domain.TreinoRepository
	itens        domain.ItemTreinoRepository
	fichaLeitura domain.FichaCompletaRepository
	treinoHoje   domain.TreinoHojeRepository
	alunos       AlunoLookup
	templates    domain.TemplateTreinoRepository
}

// NewTrainingService monta o service com todas as suas dependências.
func NewTrainingService(
	fichas domain.FichaRepository,
	treinos domain.TreinoRepository,
	itens domain.ItemTreinoRepository,
	fichaLeitura domain.FichaCompletaRepository,
	treinoHoje domain.TreinoHojeRepository,
	alunos AlunoLookup,
	templates domain.TemplateTreinoRepository,
) *TrainingService {
	return &TrainingService{
		fichas:       fichas,
		treinos:      treinos,
		itens:        itens,
		fichaLeitura: fichaLeitura,
		treinoHoje:   treinoHoje,
		alunos:       alunos,
		templates:    templates,
	}
}

// ── Fichas ─────────────────────────────────────────────────────────────────

// CriarFicha cria uma nova ficha vinculando aluno e personal autenticado.
// Verifica ownership (aluno pertence ao personal) antes de inserir.
func (s *TrainingService) CriarFicha(
	ctx context.Context,
	personalID uuid.UUID,
	req CriarFichaRequest,
) (*FichaResponse, error) {
	alunoID, err := uuid.Parse(req.AlunoID)
	if err != nil {
		return nil, fmt.Errorf("application: parse aluno_id: %w", err)
	}

	owns, err := s.alunos.BelongsToPersonal(ctx, alunoID, personalID)
	if err != nil {
		return nil, fmt.Errorf("application: verificar ownership do aluno: %w", err)
	}
	if !owns {
		return nil, domain.ErrFichaForbidden
	}

	inicio, err := time.Parse(dateLayout, req.VigenciaInicio)
	if err != nil {
		return nil, fmt.Errorf("application: parse vigencia_inicio: %w", err)
	}

	ficha := &domain.FichaTreino{
		ID:             uuid.New(),
		AlunoID:        alunoID,
		PersonalID:     personalID,
		Nome:           strings.TrimSpace(req.Nome),
		VigenciaInicio: inicio,
		Ativa:          true,
	}

	if req.VigenciaFim != "" {
		fim, err := time.Parse(dateLayout, req.VigenciaFim)
		if err != nil {
			return nil, fmt.Errorf("application: parse vigencia_fim: %w", err)
		}
		ficha.VigenciaFim = &fim
	}

	if err := s.fichas.Create(ctx, ficha); err != nil {
		return nil, fmt.Errorf("application: create ficha: %w", err)
	}

	log.Info().
		Str("ficha_id", ficha.ID.String()).
		Str("aluno_id", alunoID.String()).
		Str("personal_id", personalID.String()).
		Msg("ficha de treino criada")

	resp := fichaToResponse(ficha, nil)
	return &resp, nil
}

// ListarFichas retorna fichas do personal com filtros opcionais por aluno e
// status (ativa). Não carrega treinos (otimização: a tela de listagem só
// precisa dos metadados).
func (s *TrainingService) ListarFichas(
	ctx context.Context,
	personalID uuid.UUID,
	alunoID *uuid.UUID,
	ativa *bool,
) (*FichaListResponse, error) {
	rows, err := s.fichas.List(ctx, domain.ListFichasFilter{
		PersonalID: personalID,
		AlunoID:    alunoID,
		Ativa:      ativa,
	})
	if err != nil {
		return nil, fmt.Errorf("application: list fichas: %w", err)
	}

	out := make([]FichaResponse, 0, len(rows))
	for _, f := range rows {
		out = append(out, fichaToResponse(f, nil))
	}
	return &FichaListResponse{Data: out}, nil
}

// BuscarFicha retorna a ficha com todos os treinos e itens. Aplica autorização
// via personal_id da própria ficha (anti-enumeration: 404 quando não pertence).
func (s *TrainingService) BuscarFicha(
	ctx context.Context,
	personalID, fichaID uuid.UUID,
) (*FichaResponse, error) {
	if _, err := s.requireFichaOfPersonal(ctx, fichaID, personalID); err != nil {
		return nil, err
	}

	completa, err := s.fichaLeitura.GetCompleta(ctx, fichaID)
	if err != nil {
		return nil, fmt.Errorf("application: get ficha completa: %w", err)
	}

	resp := fichaCompletaToResponse(completa)
	return &resp, nil
}

// AtualizarFicha aplica as alterações nos campos não-nulos do request.
func (s *TrainingService) AtualizarFicha(
	ctx context.Context,
	personalID, fichaID uuid.UUID,
	req AtualizarFichaRequest,
) (*FichaResponse, error) {
	ficha, err := s.requireFichaOfPersonal(ctx, fichaID, personalID)
	if err != nil {
		return nil, err
	}

	if req.Nome != nil {
		ficha.Nome = strings.TrimSpace(*req.Nome)
	}
	if req.VigenciaInicio != nil {
		t, err := time.Parse(dateLayout, *req.VigenciaInicio)
		if err != nil {
			return nil, fmt.Errorf("application: parse vigencia_inicio: %w", err)
		}
		ficha.VigenciaInicio = t
	}
	if req.VigenciaFim != nil {
		if *req.VigenciaFim == "" {
			ficha.VigenciaFim = nil
		} else {
			t, err := time.Parse(dateLayout, *req.VigenciaFim)
			if err != nil {
				return nil, fmt.Errorf("application: parse vigencia_fim: %w", err)
			}
			ficha.VigenciaFim = &t
		}
	}
	if req.Ativa != nil {
		ficha.Ativa = *req.Ativa
	}

	if err := s.fichas.Update(ctx, ficha); err != nil {
		return nil, fmt.Errorf("application: update ficha: %w", err)
	}

	log.Info().
		Str("ficha_id", ficha.ID.String()).
		Str("personal_id", personalID.String()).
		Msg("ficha de treino atualizada")

	resp := fichaToResponse(ficha, nil)
	return &resp, nil
}

// DesativarFicha aplica soft-delete (ativa=false). Idempotente: já-desativada
// retorna sucesso silencioso.
func (s *TrainingService) DesativarFicha(
	ctx context.Context,
	personalID, fichaID uuid.UUID,
) error {
	ficha, err := s.requireFichaOfPersonal(ctx, fichaID, personalID)
	if err != nil {
		return err
	}
	if !ficha.Ativa {
		return nil
	}

	if err := s.fichas.Deactivate(ctx, fichaID); err != nil {
		return fmt.Errorf("application: deactivate ficha: %w", err)
	}

	log.Info().
		Str("ficha_id", fichaID.String()).
		Str("personal_id", personalID.String()).
		Msg("ficha de treino desativada")
	return nil
}

// BuscarFichaAtivaDoAluno é usado pela rota /alunos/me/ficha (role=ALUNO).
// Retorna a ficha ativa atual com todos os treinos/itens.
func (s *TrainingService) BuscarFichaAtivaDoAluno(
	ctx context.Context,
	alunoID uuid.UUID,
) (*FichaResponse, error) {
	ficha, err := s.fichas.FindAtivaByAluno(ctx, alunoID)
	if err != nil {
		return nil, err
	}

	completa, err := s.fichaLeitura.GetCompleta(ctx, ficha.ID)
	if err != nil {
		return nil, fmt.Errorf("application: get ficha completa: %w", err)
	}

	resp := fichaCompletaToResponse(completa)
	return &resp, nil
}

// ── Treinos ────────────────────────────────────────────────────────────────

// CriarTreino adiciona um treino (A/B/C/...) à ficha.
func (s *TrainingService) CriarTreino(
	ctx context.Context,
	personalID, fichaID uuid.UUID,
	req CriarTreinoRequest,
) (*TreinoResponse, error) {
	if _, err := s.requireFichaOfPersonal(ctx, fichaID, personalID); err != nil {
		return nil, err
	}

	tr := &domain.Treino{
		ID:      uuid.New(),
		FichaID: fichaID,
		Letra:   strings.ToUpper(strings.TrimSpace(req.Letra)),
		Nome:    strings.TrimSpace(req.Nome),
		Ordem:   req.Ordem,
	}

	if err := s.treinos.Create(ctx, tr); err != nil {
		// O repositório traduz unique_violation em ErrLetraJaUsada.
		return nil, fmt.Errorf("application: create treino: %w", err)
	}

	log.Info().
		Str("treino_id", tr.ID.String()).
		Str("ficha_id", fichaID.String()).
		Str("personal_id", personalID.String()).
		Msg("treino criado")

	resp := treinoToResponse(tr, nil)
	return &resp, nil
}

// AtualizarTreino aplica patch parcial.
func (s *TrainingService) AtualizarTreino(
	ctx context.Context,
	personalID, treinoID uuid.UUID,
	req AtualizarTreinoRequest,
) (*TreinoResponse, error) {
	tr, err := s.requireTreinoOfPersonal(ctx, treinoID, personalID)
	if err != nil {
		return nil, err
	}

	if req.Letra != nil {
		tr.Letra = strings.ToUpper(strings.TrimSpace(*req.Letra))
	}
	if req.Nome != nil {
		tr.Nome = strings.TrimSpace(*req.Nome)
	}
	if req.Ordem != nil {
		tr.Ordem = *req.Ordem
	}

	if err := s.treinos.Update(ctx, tr); err != nil {
		return nil, fmt.Errorf("application: update treino: %w", err)
	}

	resp := treinoToResponse(tr, nil)
	return &resp, nil
}

// RemoverTreino apaga o treino (e seus itens, em cascata via FK).
func (s *TrainingService) RemoverTreino(
	ctx context.Context,
	personalID, treinoID uuid.UUID,
) error {
	if _, err := s.requireTreinoOfPersonal(ctx, treinoID, personalID); err != nil {
		return err
	}
	if err := s.treinos.Delete(ctx, treinoID); err != nil {
		return fmt.Errorf("application: delete treino: %w", err)
	}

	log.Info().
		Str("treino_id", treinoID.String()).
		Str("personal_id", personalID.String()).
		Msg("treino removido")
	return nil
}

// ── Itens de treino ────────────────────────────────────────────────────────

// CriarItemTreino adiciona um item (exercício prescrito) ao treino.
func (s *TrainingService) CriarItemTreino(
	ctx context.Context,
	personalID, treinoID uuid.UUID,
	req CriarItemTreinoRequest,
) (*ItemTreinoResponse, error) {
	if _, err := s.requireTreinoOfPersonal(ctx, treinoID, personalID); err != nil {
		return nil, err
	}

	exID, err := uuid.Parse(req.ExercicioID)
	if err != nil {
		return nil, fmt.Errorf("application: parse exercicio_id: %w", err)
	}

	it := &domain.ItemTreino{
		ID:               uuid.New(),
		TreinoID:         treinoID,
		ExercicioID:      exID,
		Ordem:            req.Ordem,
		Series:           req.Series,
		Repeticoes:       strings.TrimSpace(req.Repeticoes),
		CargaSugerida:    req.CargaSugerida,
		DescansoSegundos: req.DescansoSegundos,
		Observacao:       strings.TrimSpace(req.Observacao),
	}

	if err := s.itens.Create(ctx, it); err != nil {
		return nil, fmt.Errorf("application: create item: %w", err)
	}

	log.Info().
		Str("item_id", it.ID.String()).
		Str("treino_id", treinoID.String()).
		Str("personal_id", personalID.String()).
		Msg("item de treino criado")

	resp := itemSimplesToResponse(it)
	return &resp, nil
}

// AtualizarItemTreino aplica patch parcial.
func (s *TrainingService) AtualizarItemTreino(
	ctx context.Context,
	personalID, itemID uuid.UUID,
	req AtualizarItemTreinoRequest,
) (*ItemTreinoResponse, error) {
	it, err := s.requireItemOfPersonal(ctx, itemID, personalID)
	if err != nil {
		return nil, err
	}

	if req.Ordem != nil {
		it.Ordem = *req.Ordem
	}
	if req.Series != nil {
		it.Series = *req.Series
	}
	if req.Repeticoes != nil {
		it.Repeticoes = strings.TrimSpace(*req.Repeticoes)
	}
	if req.CargaSugerida != nil {
		it.CargaSugerida = req.CargaSugerida
	}
	if req.DescansoSegundos != nil {
		it.DescansoSegundos = req.DescansoSegundos
	}
	if req.Observacao != nil {
		it.Observacao = strings.TrimSpace(*req.Observacao)
	}

	if err := s.itens.Update(ctx, it); err != nil {
		return nil, fmt.Errorf("application: update item: %w", err)
	}

	resp := itemSimplesToResponse(it)
	return &resp, nil
}

// RemoverItemTreino apaga o item.
func (s *TrainingService) RemoverItemTreino(
	ctx context.Context,
	personalID, itemID uuid.UUID,
) error {
	if _, err := s.requireItemOfPersonal(ctx, itemID, personalID); err != nil {
		return err
	}
	if err := s.itens.Delete(ctx, itemID); err != nil {
		return fmt.Errorf("application: delete item: %w", err)
	}

	log.Info().
		Str("item_id", itemID.String()).
		Str("personal_id", personalID.String()).
		Msg("item de treino removido")
	return nil
}

// ReordenarItens atualiza a coluna ordem dos itens em uma única transação.
func (s *TrainingService) ReordenarItens(
	ctx context.Context,
	personalID, treinoID uuid.UUID,
	req ReordenarItensRequest,
) error {
	if _, err := s.requireTreinoOfPersonal(ctx, treinoID, personalID); err != nil {
		return err
	}

	ids := make([]uuid.UUID, 0, len(req.IDs))
	for _, raw := range req.IDs {
		id, err := uuid.Parse(raw)
		if err != nil {
			return fmt.Errorf("application: parse id reorder: %w", err)
		}
		ids = append(ids, id)
	}

	if err := s.itens.Reorder(ctx, treinoID, ids); err != nil {
		return fmt.Errorf("application: reorder itens: %w", err)
	}

	log.Info().
		Str("treino_id", treinoID.String()).
		Str("personal_id", personalID.String()).
		Int("itens", len(ids)).
		Msg("itens de treino reordenados")
	return nil
}

// ── Treino do dia ─────────────────────────────────────────────────────────

// ObterTreinoHoje devolve o próximo treino da sequência para o aluno
// autenticado. Retorna ErrSemFichaAtiva quando não há ficha vigente
// (HTTP 204) e ErrSemTreinoHoje quando há ficha mas sem treinos.
func (s *TrainingService) ObterTreinoHoje(
	ctx context.Context,
	alunoID uuid.UUID,
) (*TreinoHojeResponse, error) {
	completo, err := s.treinoHoje.GetTreinoHoje(ctx, alunoID)
	if err != nil {
		return nil, err
	}

	tr := treinoCompletoToResponse(*completo)
	return &TreinoHojeResponse{
		Treino: &tr,
		// SessaoHojeID será preenchido pelo contexto Execution na Fase 1.4.
		SessaoHojeID: nil,
	}, nil
}

// ── Templates ──────────────────────────────────────────────────────────────

// ListarTemplates devolve os templates de ficha disponíveis pro personal
// (globais do sistema + custom dele), com filtros opcionais de
// nivel/objetivo — usado pra popular a tela de "escolher template" quando
// o personal não quer aceitar a sugestão automática da anamnese.
func (s *TrainingService) ListarTemplates(
	ctx context.Context,
	personalID uuid.UUID,
	nivel, objetivo *string,
) (*TemplateListResponse, error) {
	rows, err := s.templates.List(ctx, domain.ListTemplatesFilter{
		PersonalID: personalID,
		Nivel:      nivel,
		Objetivo:   objetivo,
	})
	if err != nil {
		return nil, fmt.Errorf("application: list templates: %w", err)
	}

	out := make([]TemplateResponse, 0, len(rows))
	for _, t := range rows {
		out = append(out, templateComItensToResponse(t))
	}
	return &TemplateListResponse{Data: out}, nil
}

// CriarFichaFromTemplate aplica um template a um aluno, criando uma ficha
// nova com treinos/itens copiados do template (SDD §20.2, "Personal aceita
// o template"). Verifica ownership do aluno antes de copiar.
func (s *TrainingService) CriarFichaFromTemplate(
	ctx context.Context,
	personalID uuid.UUID,
	req CriarFichaFromTemplateRequest,
) (*FichaResponse, error) {
	templateID, err := uuid.Parse(req.TemplateID)
	if err != nil {
		return nil, fmt.Errorf("application: parse template_id: %w", err)
	}
	alunoID, err := uuid.Parse(req.AlunoID)
	if err != nil {
		return nil, fmt.Errorf("application: parse aluno_id: %w", err)
	}

	owns, err := s.alunos.BelongsToPersonal(ctx, alunoID, personalID)
	if err != nil {
		return nil, fmt.Errorf("application: verificar ownership do aluno: %w", err)
	}
	if !owns {
		return nil, domain.ErrFichaForbidden
	}

	inicio, err := time.Parse(dateLayout, req.VigenciaInicio)
	if err != nil {
		return nil, fmt.Errorf("application: parse vigencia_inicio: %w", err)
	}

	completa, err := s.templates.AplicarTemplate(
		ctx, templateID, alunoID, personalID, strings.TrimSpace(req.Nome), inicio,
	)
	if err != nil {
		return nil, fmt.Errorf("application: aplicar template: %w", err)
	}

	log.Info().
		Str("template_id", templateID.String()).
		Str("ficha_id", completa.Ficha.ID.String()).
		Str("aluno_id", alunoID.String()).
		Str("personal_id", personalID.String()).
		Msg("ficha criada a partir de template")

	resp := fichaCompletaToResponse(completa)
	return &resp, nil
}

// ── Helpers de autorização ────────────────────────────────────────────────

// requireFichaOfPersonal carrega a ficha e verifica ownership. Quando a ficha
// não existe ou pertence a outro personal retorna ErrFichaNotFound — o handler
// devolve 404 em ambos os casos (anti-enumeration).
func (s *TrainingService) requireFichaOfPersonal(
	ctx context.Context,
	fichaID, personalID uuid.UUID,
) (*domain.FichaTreino, error) {
	ficha, err := s.fichas.FindByID(ctx, fichaID)
	if err != nil {
		if errors.Is(err, domain.ErrFichaNotFound) {
			return nil, err
		}
		return nil, fmt.Errorf("application: find ficha: %w", err)
	}
	if ficha.PersonalID != personalID {
		return nil, domain.ErrFichaForbidden
	}
	return ficha, nil
}

// requireTreinoOfPersonal carrega o treino e checa ownership transitivo via ficha.
func (s *TrainingService) requireTreinoOfPersonal(
	ctx context.Context,
	treinoID, personalID uuid.UUID,
) (*domain.Treino, error) {
	tr, err := s.treinos.FindByID(ctx, treinoID)
	if err != nil {
		if errors.Is(err, domain.ErrTreinoNotFound) {
			return nil, err
		}
		return nil, fmt.Errorf("application: find treino: %w", err)
	}
	if _, err := s.requireFichaOfPersonal(ctx, tr.FichaID, personalID); err != nil {
		// Reescreve para preservar a semântica do recurso solicitado.
		if errors.Is(err, domain.ErrFichaForbidden) || errors.Is(err, domain.ErrFichaNotFound) {
			return nil, domain.ErrTreinoForbidden
		}
		return nil, err
	}
	return tr, nil
}

// requireItemOfPersonal carrega o item e checa ownership via treino → ficha.
func (s *TrainingService) requireItemOfPersonal(
	ctx context.Context,
	itemID, personalID uuid.UUID,
) (*domain.ItemTreino, error) {
	it, err := s.itens.FindByID(ctx, itemID)
	if err != nil {
		if errors.Is(err, domain.ErrItemTreinoNotFound) {
			return nil, err
		}
		return nil, fmt.Errorf("application: find item: %w", err)
	}
	if _, err := s.requireTreinoOfPersonal(ctx, it.TreinoID, personalID); err != nil {
		if errors.Is(err, domain.ErrTreinoForbidden) || errors.Is(err, domain.ErrTreinoNotFound) {
			return nil, domain.ErrItemTreinoForbidden
		}
		return nil, err
	}
	return it, nil
}

// ── Mappers ────────────────────────────────────────────────────────────────

// fichaToResponse converte a entidade em DTO. Quando treinos != nil, são
// embutidos no campo Treinos; caso contrário, o slice é vazio (lista resumida).
func fichaToResponse(f *domain.FichaTreino, treinos []TreinoResponse) FichaResponse {
	resp := FichaResponse{
		ID:             f.ID.String(),
		AlunoID:        f.AlunoID.String(),
		Nome:           f.Nome,
		VigenciaInicio: f.VigenciaInicio.Format(dateLayout),
		Ativa:          f.Ativa,
		Treinos:        treinos,
	}
	if f.VigenciaFim != nil {
		s := f.VigenciaFim.Format(dateLayout)
		resp.VigenciaFim = &s
	}
	if resp.Treinos == nil {
		resp.Treinos = []TreinoResponse{}
	}
	return resp
}

// fichaCompletaToResponse mapeia o read-model agregado para o DTO de saída.
func fichaCompletaToResponse(c *domain.FichaCompleta) FichaResponse {
	treinos := make([]TreinoResponse, 0, len(c.Treinos))
	for _, t := range c.Treinos {
		treinos = append(treinos, treinoCompletoToResponse(t))
	}
	return fichaToResponse(&c.Ficha, treinos)
}

// treinoToResponse converte o treino. Quando itens é nil produz array vazio.
func treinoToResponse(t *domain.Treino, itens []ItemTreinoResponse) TreinoResponse {
	if itens == nil {
		itens = []ItemTreinoResponse{}
	}
	resp := TreinoResponse{
		ID:    t.ID.String(),
		Letra: t.Letra,
		Ordem: t.Ordem,
		Itens: itens,
	}
	if t.Nome != "" {
		nome := t.Nome
		resp.Nome = &nome
	}
	return resp
}

// treinoCompletoToResponse mapeia treino + itens enriquecidos.
func treinoCompletoToResponse(c domain.TreinoCompleto) TreinoResponse {
	itens := make([]ItemTreinoResponse, 0, len(c.Itens))
	for _, i := range c.Itens {
		itens = append(itens, itemComExercicioToResponse(i))
	}
	return treinoToResponse(&c.Treino, itens)
}

// itemSimplesToResponse converte um ItemTreino (sem exercício) — usado em
// CriarItemTreino e AtualizarItemTreino, em que retornamos só o item.
//
// O cliente já tinha o exercício em cache (foi ele que escolheu); manter o
// payload mínimo evita reload pesado a cada PATCH.
func itemSimplesToResponse(i *domain.ItemTreino) ItemTreinoResponse {
	resp := ItemTreinoResponse{
		ID:               i.ID.String(),
		Ordem:            i.Ordem,
		Series:           i.Series,
		Repeticoes:       i.Repeticoes,
		CargaSugerida:    i.CargaSugerida,
		DescansoSegundos: i.DescansoSegundos,
		Exercicio: ExercicioResumoResponse{
			ID: i.ExercicioID.String(),
		},
	}
	if i.Observacao != "" {
		obs := i.Observacao
		resp.Observacao = &obs
	}
	return resp
}

// templateComItensToResponse mapeia um template com seus itens para o DTO
// de saída. Os itens não trazem dados completos do exercício (só o ID) —
// diferente de ItemTreinoResponse, o catálogo de templates não faz JOIN com
// exercicio/grupo_muscular; o cliente já tem o catálogo de exercícios em
// cache para exibir nome/mídia quando necessário.
func templateComItensToResponse(t domain.TemplateComItens) TemplateResponse {
	itens := make([]TemplateItemResponse, 0, len(t.Itens))
	for _, i := range t.Itens {
		item := TemplateItemResponse{
			ID:               i.ID.String(),
			Exercicio:        ExercicioResumoResponse{ID: i.ExercicioID.String()},
			TreinoLetra:      i.TreinoLetra,
			Ordem:            i.Ordem,
			Series:           i.Series,
			Repeticoes:       i.Repeticoes,
			CargaSugerida:    i.CargaSugerida,
			DescansoSegundos: i.DescansoSegundos,
		}
		itens = append(itens, item)
	}
	return TemplateResponse{
		ID:        t.Template.ID.String(),
		Nome:      t.Template.Nome,
		Nivel:     t.Template.Nivel,
		Objetivo:  t.Template.Objetivo,
		CriadoPor: string(t.Template.CriadoPor),
		Itens:     itens,
	}
}

// itemComExercicioToResponse mapeia o read-model com dados do exercício/grupo.
func itemComExercicioToResponse(i domain.ItemTreinoComExercicio) ItemTreinoResponse {
	resp := ItemTreinoResponse{
		ID:               i.ID.String(),
		Ordem:            i.Ordem,
		Series:           i.Series,
		Repeticoes:       i.Repeticoes,
		CargaSugerida:    i.CargaSugerida,
		DescansoSegundos: i.DescansoSegundos,
		Exercicio: ExercicioResumoResponse{
			ID:        i.ExercicioID.String(),
			Nome:      i.ExercicioNome,
			Descricao: i.ExercicioDescricao,
			MidiaURL:  i.ExercicioMidiaURL,
			TipoMidia: i.ExercicioTipoMidia,
			IsGlobal:  i.ExercicioIsGlobal,
			GrupoMuscular: GrupoMuscularResposta{
				ID:   i.GrupoMuscularID.String(),
				Nome: i.GrupoMuscularNome,
			},
		},
	}
	if i.Observacao != "" {
		obs := i.Observacao
		resp.Observacao = &obs
	}
	return resp
}
