package application

import (
	"context"
	"fmt"

	"github.com/amfit/api/internal/progress/domain"
	"github.com/google/uuid"
)

// RegistrarAnamneseParams e o payload (ja parseado) de
// POST /alunos/{id}/anamnese.
type RegistrarAnamneseParams struct {
	Objetivo                  string
	Lesoes                    *string
	DoencasPreexistentes      *string
	Medicamentos              *string
	PraticaOutroEsporte       bool
	OutroEsporte              *string
	FrequenciaSemanasAnterior *int
	ObservacoesGerais         *string
	Respostas                 domain.AnamneseRespostasInput
}

// AnamneseComTemplate agrega a anamnese salva com o template de ficha
// sugerido (quando existe um match) — e o retorno de RegistrarAnamnese,
// espelhando o fluxo do SDD §20.2: a mesma chamada que salva a anamnese
// ja devolve a sugestao de template pro personal decidir.
type AnamneseComTemplate struct {
	Anamnese domain.Anamnese
	Template *domain.TemplateMatch
}

// RegistrarAnamnese calcula o score/nivel a partir das respostas, persiste
// a anamnese (upsert por aluno_id) e busca o melhor template compativel.
func (s *ProgressService) RegistrarAnamnese(
	ctx context.Context,
	personalID, alunoID uuid.UUID,
	params RegistrarAnamneseParams,
) (AnamneseComTemplate, error) {
	if s.access != nil {
		if err := s.access.AlunoExisteEPertenceAoPersonal(ctx, personalID, alunoID); err != nil {
			return AnamneseComTemplate{}, err
		}
	}
	if s.anamnese == nil {
		return AnamneseComTemplate{}, domain.ErrRepositorioNaoConfigurado
	}

	respostas, score, nivel, err := domain.CalcularScoreAnamnese(params.Respostas)
	if err != nil {
		return AnamneseComTemplate{}, err
	}

	anamnese := &domain.Anamnese{
		AlunoID:                   alunoID,
		Objetivo:                  params.Objetivo,
		Lesoes:                    params.Lesoes,
		DoencasPreexistentes:      params.DoencasPreexistentes,
		Medicamentos:              params.Medicamentos,
		PraticaOutroEsporte:       params.PraticaOutroEsporte,
		OutroEsporte:              params.OutroEsporte,
		FrequenciaSemanasAnterior: params.FrequenciaSemanasAnterior,
		ObservacoesGerais:         params.ObservacoesGerais,
		Respostas:                 respostas,
		ScoreCalculado:            score,
		NivelSugerido:             nivel,
	}
	if err := s.anamnese.Upsert(ctx, anamnese); err != nil {
		return AnamneseComTemplate{}, fmt.Errorf("application: upsert anamnese: %w", err)
	}

	var template *domain.TemplateMatch
	if s.templateMatcher != nil {
		if objetivoTemplate := domain.TemplateObjetivoParaNivel(params.Respostas.Objetivo); objetivoTemplate != "" {
			template, err = s.templateMatcher.MelhorMatch(ctx, personalID, string(nivel), objetivoTemplate)
			if err != nil {
				return AnamneseComTemplate{}, fmt.Errorf("application: melhor match de template: %w", err)
			}
		}
	}

	return AnamneseComTemplate{Anamnese: *anamnese, Template: template}, nil
}

// ObterAnamnese devolve a anamnese ja registrada de um aluno do personal
// autenticado. ErrAnamneseNotFound quando o aluno ainda nao preencheu.
func (s *ProgressService) ObterAnamnese(
	ctx context.Context,
	personalID, alunoID uuid.UUID,
) (domain.Anamnese, error) {
	if s.access != nil {
		if err := s.access.AlunoExisteEPertenceAoPersonal(ctx, personalID, alunoID); err != nil {
			return domain.Anamnese{}, err
		}
	}
	if s.anamnese == nil {
		return domain.Anamnese{}, domain.ErrRepositorioNaoConfigurado
	}

	a, err := s.anamnese.FindByAlunoID(ctx, alunoID)
	if err != nil {
		return domain.Anamnese{}, err
	}
	return *a, nil
}
