// Package handlers contém os handlers HTTP do contexto Progress.
package handlers

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/amfit/api/internal/progress/application"
	"github.com/amfit/api/internal/progress/domain"
	"github.com/amfit/api/pkg/middleware"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// ProgressHandler expoe os endpoints de progresso e dashboard.
type ProgressHandler struct {
	svc      *application.ProgressService
	validate *validator.Validate
}

// NewProgressHandler cria o handler com o servico injetado.
func NewProgressHandler(svc *application.ProgressService) *ProgressHandler {
	return &ProgressHandler{
		svc:      svc,
		validate: validator.New(validator.WithRequiredStructEnabled()),
	}
}

// RegisterAlunoRoutes registra as rotas que o ALUNO consome sobre seu
// proprio progresso.
func (h *ProgressHandler) RegisterAlunoRoutes(router fiber.Router, mws ...fiber.Handler) {
	middleware.Get(router, "/alunos/me/progresso/exercicio/:exercicioId",
		mws, h.HistoricoExercicioAlunoLogado)
	middleware.Get(router, "/alunos/me/progresso/exercicio/:exercicioId/sugestao",
		mws, h.SugestaoExercicioAlunoLogado)
}

// RegisterPersonalRoutes registra as rotas que o PERSONAL consome sobre
// o progresso dos seus alunos + dashboard.
func (h *ProgressHandler) RegisterPersonalRoutes(router fiber.Router, mws ...fiber.Handler) {
	middleware.Get(router, "/alunos/:alunoId/progresso/exercicio/:exercicioId",
		mws, h.HistoricoExercicioDoAluno)
	middleware.Get(router, "/alunos/:alunoId/progresso/exercicio/:exercicioId/sugestao",
		mws, h.SugestaoExercicioDoAluno)
	middleware.Post(router, "/alunos/:alunoId/anamnese", mws, h.RegistrarAnamnese)
	middleware.Get(router, "/alunos/:alunoId/anamnese", mws, h.ObterAnamnese)
	middleware.Get(router, "/dashboard", mws, h.Dashboard)
}

// ─── Aluno: historico proprio ──────────────────────────────────────────────

// HistoricoExercicioAlunoLogado trata
// GET /alunos/me/progresso/exercicio/:exercicioId (role=ALUNO).
//
// Query opcional:
//   - from, to (YYYY-MM-DD)
//   - limit    (1..500)
func (h *ProgressHandler) HistoricoExercicioAlunoLogado(c fiber.Ctx) error {
	alunoID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	exercicioID, err := uuid.Parse(c.Params("exercicioId"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"exercicioId invalido",
		))
	}

	params, perr := parseHistoricoParams(c)
	if perr != nil {
		return middleware.WriteProblem(c, *perr)
	}

	resp, err := h.svc.HistoricoDoAlunoLogado(c.Context(), alunoID, exercicioID, params)
	if err != nil {
		return writeProgressError(c, err, "falha ao buscar historico")
	}
	return c.JSON(toHistoricoResponse(resp))
}

// HistoricoExercicioDoAluno trata
// GET /alunos/:alunoId/progresso/exercicio/:exercicioId (role=PERSONAL).
func (h *ProgressHandler) HistoricoExercicioDoAluno(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	alunoID, err := uuid.Parse(c.Params("alunoId"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"alunoId invalido",
		))
	}
	exercicioID, err := uuid.Parse(c.Params("exercicioId"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"exercicioId invalido",
		))
	}

	params, perr := parseHistoricoParams(c)
	if perr != nil {
		return middleware.WriteProblem(c, *perr)
	}

	resp, err := h.svc.HistoricoDoAlunoVistoPeloPersonal(
		c.Context(), personalID, alunoID, exercicioID, params,
	)
	if err != nil {
		return writeProgressError(c, err, "falha ao buscar historico")
	}
	return c.JSON(toHistoricoResponse(resp))
}

// SugestaoExercicioAlunoLogado trata
// GET /alunos/me/progresso/exercicio/:exercicioId/sugestao (role=ALUNO).
func (h *ProgressHandler) SugestaoExercicioAlunoLogado(c fiber.Ctx) error {
	alunoID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	exercicioID, err := uuid.Parse(c.Params("exercicioId"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"exercicioId invalido",
		))
	}

	resp, err := h.svc.SugestaoDoAlunoLogado(c.Context(), alunoID, exercicioID)
	if err != nil {
		return writeProgressError(c, err, "falha ao calcular sugestao")
	}
	return c.JSON(toSugestaoResponse(resp))
}

// SugestaoExercicioDoAluno trata
// GET /alunos/:alunoId/progresso/exercicio/:exercicioId/sugestao (role=PERSONAL).
func (h *ProgressHandler) SugestaoExercicioDoAluno(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	alunoID, err := uuid.Parse(c.Params("alunoId"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"alunoId invalido",
		))
	}
	exercicioID, err := uuid.Parse(c.Params("exercicioId"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"exercicioId invalido",
		))
	}

	resp, err := h.svc.SugestaoDoAlunoVistoPeloPersonal(c.Context(), personalID, alunoID, exercicioID)
	if err != nil {
		return writeProgressError(c, err, "falha ao calcular sugestao")
	}
	return c.JSON(toSugestaoResponse(resp))
}

// ─── Personal: dashboard ───────────────────────────────────────────────────

// Dashboard trata GET /dashboard (role=PERSONAL).
func (h *ProgressHandler) Dashboard(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}

	resumo, err := h.svc.Dashboard(c.Context(), personalID)
	if err != nil {
		log.Error().Err(err).Str("personal_id", personalID.String()).Msg("dashboard query failed")
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao buscar dashboard",
		))
	}
	return c.JSON(toDashboardResponse(resumo))
}

// ─── Personal: anamnese inteligente ────────────────────────────────────────

// RegistrarAnamnese trata POST /alunos/:alunoId/anamnese (role=PERSONAL).
// Calcula score/nivel no backend (nunca confia em pontos do cliente) e
// devolve, junto com a anamnese salva, o template de ficha sugerido —
// SDD §20.2.
func (h *ProgressHandler) RegistrarAnamnese(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	alunoID, err := uuid.Parse(c.Params("alunoId"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"alunoId invalido",
		))
	}

	var req registrarAnamneseRequestDTO
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	resultado, err := h.svc.RegistrarAnamnese(c.Context(), personalID, alunoID, req.toParams())
	if err != nil {
		return writeProgressError(c, err, "falha ao registrar anamnese")
	}
	return c.Status(fiber.StatusCreated).JSON(toAnamneseResponse(resultado))
}

// ObterAnamnese trata GET /alunos/:alunoId/anamnese (role=PERSONAL).
func (h *ProgressHandler) ObterAnamnese(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	alunoID, err := uuid.Parse(c.Params("alunoId"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"alunoId invalido",
		))
	}

	anamnese, err := h.svc.ObterAnamnese(c.Context(), personalID, alunoID)
	if err != nil {
		return writeProgressError(c, err, "falha ao buscar anamnese")
	}
	return c.JSON(toAnamneseResponse(application.AnamneseComTemplate{Anamnese: anamnese}))
}

// ─── DTOs de saida ─────────────────────────────────────────────────────────

type historicoPontoDTO struct {
	SessaoID             uuid.UUID `json:"sessao_id"`
	DataExecucao         string    `json:"data_execucao"` // YYYY-MM-DD
	NumeroSerie          int       `json:"numero_serie"`
	CargaRealizada       *float64  `json:"carga_realizada,omitempty"`
	RepeticoesRealizadas *int      `json:"repeticoes_realizadas,omitempty"`
}

type historicoResponseDTO struct {
	AlunoID     uuid.UUID           `json:"aluno_id"`
	ExercicioID uuid.UUID           `json:"exercicio_id"`
	Pontos      []historicoPontoDTO `json:"pontos"`
}

func toHistoricoResponse(h domain.HistoricoCargaExercicio) historicoResponseDTO {
	pontos := make([]historicoPontoDTO, 0, len(h.Pontos))
	for _, p := range h.Pontos {
		pontos = append(pontos, historicoPontoDTO{
			SessaoID:             p.SessaoID,
			DataExecucao:         p.DataExecucao.Format("2006-01-02"),
			NumeroSerie:          p.NumeroSerie,
			CargaRealizada:       p.CargaRealizada,
			RepeticoesRealizadas: p.RepeticoesRealizadas,
		})
	}
	return historicoResponseDTO{
		AlunoID:     h.AlunoID,
		ExercicioID: h.ExercicioID,
		Pontos:      pontos,
	}
}

type sugestaoResponseDTO struct {
	ExercicioID           uuid.UUID `json:"exercicio_id"`
	TemSugestao           bool      `json:"tem_sugestao"`
	Direcao               *string   `json:"direcao,omitempty"`
	CargaSugerida         *float64  `json:"carga_sugerida,omitempty"`
	UltimaCargaRegistrada *float64  `json:"ultima_carga_registrada,omitempty"`
	UltimaMediaRepeticoes *float64  `json:"ultima_media_repeticoes,omitempty"`
}

func toSugestaoResponse(s domain.SugestaoProgressao) sugestaoResponseDTO {
	dto := sugestaoResponseDTO{
		ExercicioID: s.ExercicioID,
		TemSugestao: s.TemSugestao,
	}
	if s.TemSugestao {
		direcao := string(s.Direcao)
		dto.Direcao = &direcao
		dto.CargaSugerida = s.CargaSugerida
		dto.UltimaCargaRegistrada = s.UltimaCargaRegistrada
		dto.UltimaMediaRepeticoes = s.UltimaMediaRepeticoes
	}
	return dto
}

type dashboardResponseDTO struct {
	AlunosAtivos         int `json:"alunos_ativos"`
	FichasAtivas         int `json:"fichas_ativas"`
	SessoesUltimos7Dias  int `json:"sessoes_ultimos_7_dias"`
	SessoesUltimos30Dias int `json:"sessoes_ultimos_30_dias"`
	AlunosSemSessao7Dias int `json:"alunos_sem_sessao_7_dias"`
}

func toDashboardResponse(r domain.DashboardResumo) dashboardResponseDTO {
	return dashboardResponseDTO{
		AlunosAtivos:         r.AlunosAtivos,
		FichasAtivas:         r.FichasAtivas,
		SessoesUltimos7Dias:  r.SessoesUltimos7Dias,
		SessoesUltimos30Dias: r.SessoesUltimos30Dias,
		AlunosSemSessao7Dias: r.AlunosSemSessao7Dias,
	}
}

// ─── Anamnese: DTOs de entrada ──────────────────────────────────────────────

// respostasAnamneseRequestDTO carrega as 5 chaves de opcao das perguntas
// padronizadas (SDD §20.2) — o backend resolve pontos e nivel, nunca aceita
// esses campos vindos prontos do cliente.
type respostasAnamneseRequestDTO struct {
	FrequenciaSemanal string `json:"frequencia_semanal" validate:"required"`
	ExperienciaMeses  string `json:"experiencia_meses" validate:"required"`
	Objetivo          string `json:"objetivo" validate:"required"`
	Restricoes        string `json:"restricoes" validate:"required"`
	Disponibilidade   string `json:"disponibilidade" validate:"required"`
}

type registrarAnamneseRequestDTO struct {
	Objetivo                  string                      `json:"objetivo" validate:"required,min=2,max=200"`
	Lesoes                    *string                     `json:"lesoes,omitempty" validate:"omitempty,max=1000"`
	DoencasPreexistentes      *string                     `json:"doencas_preexistentes,omitempty" validate:"omitempty,max=1000"`
	Medicamentos              *string                     `json:"medicamentos,omitempty" validate:"omitempty,max=1000"`
	PraticaOutroEsporte       bool                        `json:"pratica_outro_esporte"`
	OutroEsporte              *string                     `json:"outro_esporte,omitempty" validate:"omitempty,max=200"`
	FrequenciaSemanasAnterior *int                        `json:"frequencia_semanas_anterior,omitempty" validate:"omitempty,min=0,max=7"`
	ObservacoesGerais         *string                     `json:"observacoes_gerais,omitempty" validate:"omitempty,max=2000"`
	Respostas                 respostasAnamneseRequestDTO `json:"respostas"`
}

func (r registrarAnamneseRequestDTO) toParams() application.RegistrarAnamneseParams {
	return application.RegistrarAnamneseParams{
		Objetivo:                  r.Objetivo,
		Lesoes:                    r.Lesoes,
		DoencasPreexistentes:      r.DoencasPreexistentes,
		Medicamentos:              r.Medicamentos,
		PraticaOutroEsporte:       r.PraticaOutroEsporte,
		OutroEsporte:              r.OutroEsporte,
		FrequenciaSemanasAnterior: r.FrequenciaSemanasAnterior,
		ObservacoesGerais:         r.ObservacoesGerais,
		Respostas: domain.AnamneseRespostasInput{
			FrequenciaSemanal: r.Respostas.FrequenciaSemanal,
			ExperienciaMeses:  r.Respostas.ExperienciaMeses,
			Objetivo:          r.Respostas.Objetivo,
			Restricoes:        r.Respostas.Restricoes,
			Disponibilidade:   r.Respostas.Disponibilidade,
		},
	}
}

// ─── Anamnese: DTOs de saida ────────────────────────────────────────────────

type respostaAnamneseResponseDTO struct {
	Opcao  string `json:"opcao"`
	Pontos int    `json:"pontos"`
}

type respostasAnamneseResponseDTO struct {
	FrequenciaSemanal respostaAnamneseResponseDTO `json:"frequencia_semanal"`
	ExperienciaMeses  respostaAnamneseResponseDTO `json:"experiencia_meses"`
	Objetivo          respostaAnamneseResponseDTO `json:"objetivo"`
	Restricoes        respostaAnamneseResponseDTO `json:"restricoes"`
	Disponibilidade   respostaAnamneseResponseDTO `json:"disponibilidade"`
}

type anamneseResponseDTO struct {
	ID                        uuid.UUID                    `json:"id"`
	AlunoID                   uuid.UUID                    `json:"aluno_id"`
	Objetivo                  string                       `json:"objetivo"`
	Lesoes                    *string                      `json:"lesoes,omitempty"`
	DoencasPreexistentes      *string                      `json:"doencas_preexistentes,omitempty"`
	Medicamentos              *string                      `json:"medicamentos,omitempty"`
	PraticaOutroEsporte       bool                         `json:"pratica_outro_esporte"`
	OutroEsporte              *string                      `json:"outro_esporte,omitempty"`
	FrequenciaSemanasAnterior *int                         `json:"frequencia_semanas_anterior,omitempty"`
	ObservacoesGerais         *string                      `json:"observacoes_gerais,omitempty"`
	Respostas                 respostasAnamneseResponseDTO `json:"respostas"`
	ScoreCalculado            int                          `json:"score_calculado"`
	NivelSugerido             string                       `json:"nivel_sugerido"`
	TemplateFichaID           *string                      `json:"template_ficha_id,omitempty"`
	TemplateFichaNome         *string                      `json:"template_ficha_nome,omitempty"`
	PreenchidoEm              string                       `json:"preenchido_em"`
	AtualizadoEm              string                       `json:"atualizado_em"`
}

func toAnamneseResponse(r application.AnamneseComTemplate) anamneseResponseDTO {
	a := r.Anamnese
	dto := anamneseResponseDTO{
		ID:                        a.ID,
		AlunoID:                   a.AlunoID,
		Objetivo:                  a.Objetivo,
		Lesoes:                    a.Lesoes,
		DoencasPreexistentes:      a.DoencasPreexistentes,
		Medicamentos:              a.Medicamentos,
		PraticaOutroEsporte:       a.PraticaOutroEsporte,
		OutroEsporte:              a.OutroEsporte,
		FrequenciaSemanasAnterior: a.FrequenciaSemanasAnterior,
		ObservacoesGerais:         a.ObservacoesGerais,
		Respostas: respostasAnamneseResponseDTO{
			FrequenciaSemanal: respostaAnamneseResponseDTO{Opcao: a.Respostas.FrequenciaSemanal.Opcao, Pontos: a.Respostas.FrequenciaSemanal.Pontos},
			ExperienciaMeses:  respostaAnamneseResponseDTO{Opcao: a.Respostas.ExperienciaMeses.Opcao, Pontos: a.Respostas.ExperienciaMeses.Pontos},
			Objetivo:          respostaAnamneseResponseDTO{Opcao: a.Respostas.Objetivo.Opcao, Pontos: a.Respostas.Objetivo.Pontos},
			Restricoes:        respostaAnamneseResponseDTO{Opcao: a.Respostas.Restricoes.Opcao, Pontos: a.Respostas.Restricoes.Pontos},
			Disponibilidade:   respostaAnamneseResponseDTO{Opcao: a.Respostas.Disponibilidade.Opcao, Pontos: a.Respostas.Disponibilidade.Pontos},
		},
		ScoreCalculado: a.ScoreCalculado,
		NivelSugerido:  string(a.NivelSugerido),
		PreenchidoEm:   a.PreenchidoEm.Format(time.RFC3339),
		AtualizadoEm:   a.AtualizadoEm.Format(time.RFC3339),
	}
	if r.Template != nil {
		id := r.Template.ID.String()
		nome := r.Template.Nome
		dto.TemplateFichaID = &id
		dto.TemplateFichaNome = &nome
	}
	return dto
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// bindAndValidate parseia o body JSON e roda as tags de validacao do struct.
// Quando ok=false a resposta de erro (400/422) ja foi escrita.
func (h *ProgressHandler) bindAndValidate(c fiber.Ctx, dst any) bool {
	if err := c.Bind().Body(dst); err != nil {
		_ = middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"corpo da requisicao invalido",
		))
		return false
	}
	if err := h.validate.Struct(dst); err != nil {
		_ = middleware.WriteProblem(c, validationProblem(err))
		return false
	}
	return true
}

func validationProblem(err error) middleware.ProblemDetail {
	p := middleware.NewProblem(
		fiber.StatusUnprocessableEntity, "validation", "Unprocessable Entity",
		"dados invalidos",
	)

	var ve validator.ValidationErrors
	if errors.As(err, &ve) {
		p.Errors = make([]middleware.ProblemFieldError, 0, len(ve))
		for _, fe := range ve {
			p.Errors = append(p.Errors, middleware.ProblemFieldError{
				Field:   strings.ToLower(fe.Field()),
				Message: validationMessage(fe),
			})
		}
	}
	return p
}

func validationMessage(fe validator.FieldError) string {
	switch fe.Tag() {
	case "required":
		return "campo obrigatorio"
	case "min":
		return "valor abaixo do minimo (" + fe.Param() + ")"
	case "max":
		return "valor acima do maximo (" + fe.Param() + ")"
	default:
		return "valor invalido"
	}
}

func userIDFromCtx(c fiber.Ctx) (uuid.UUID, bool) {
	raw, _ := c.Locals("user_id").(string)
	id, err := uuid.Parse(raw)
	if err != nil {
		_ = middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusUnauthorized, "unauthorized", "Unauthorized",
			"sub invalido no token",
		))
		return uuid.Nil, false
	}
	return id, true
}

func parseHistoricoParams(c fiber.Ctx) (application.HistoricoParams, *middleware.ProblemDetail) {
	var p application.HistoricoParams

	if v := c.Query("from", ""); v != "" {
		t, err := time.Parse("2006-01-02", v)
		if err != nil {
			pd := middleware.NewProblem(
				fiber.StatusBadRequest, "bad-request", "Bad Request",
				"from invalido (esperado YYYY-MM-DD)",
			)
			return p, &pd
		}
		p.From = &t
	}
	if v := c.Query("to", ""); v != "" {
		t, err := time.Parse("2006-01-02", v)
		if err != nil {
			pd := middleware.NewProblem(
				fiber.StatusBadRequest, "bad-request", "Bad Request",
				"to invalido (esperado YYYY-MM-DD)",
			)
			return p, &pd
		}
		p.To = &t
	}
	if v := c.Query("limit", ""); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			pd := middleware.NewProblem(
				fiber.StatusBadRequest, "bad-request", "Bad Request",
				"limit invalido (esperado inteiro positivo)",
			)
			return p, &pd
		}
		p.Limit = &n
	}
	return p, nil
}

func writeProgressError(c fiber.Ctx, err error, fallback string) error {
	switch {
	case errors.Is(err, domain.ErrAlunoNotFound),
		errors.Is(err, domain.ErrExercicioNotFound),
		errors.Is(err, domain.ErrAnamneseNotFound):
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusNotFound, "not-found", "Not Found",
			"recurso nao encontrado",
		))
	case errors.Is(err, domain.ErrOpcaoAnamneseInvalida):
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusUnprocessableEntity, "validation", "Unprocessable Entity",
			"opcao de resposta invalida",
		))
	}
	log.Error().Err(err).Str("path", c.Path()).Msg("progress handler error")
	return middleware.WriteProblem(c, middleware.NewProblem(
		fiber.StatusInternalServerError, "internal", "Internal Server Error",
		fallback,
	))
}
