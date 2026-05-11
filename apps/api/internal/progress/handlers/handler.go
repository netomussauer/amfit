// Package handlers contém os handlers HTTP do contexto Progress.
package handlers

import (
	"errors"
	"strconv"
	"time"

	"github.com/amfit/api/internal/progress/application"
	"github.com/amfit/api/internal/progress/domain"
	"github.com/amfit/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// ProgressHandler expoe os endpoints de progresso e dashboard.
type ProgressHandler struct {
	svc *application.ProgressService
}

// NewProgressHandler cria o handler com o servico injetado.
func NewProgressHandler(svc *application.ProgressService) *ProgressHandler {
	return &ProgressHandler{svc: svc}
}

// RegisterAlunoRoutes registra as rotas que o ALUNO consome sobre seu
// proprio progresso.
func (h *ProgressHandler) RegisterAlunoRoutes(router fiber.Router, mws ...fiber.Handler) {
	middleware.Get(router, "/alunos/me/progresso/exercicio/:exercicioId",
		mws, h.HistoricoExercicioAlunoLogado)
}

// RegisterPersonalRoutes registra as rotas que o PERSONAL consome sobre
// o progresso dos seus alunos + dashboard.
func (h *ProgressHandler) RegisterPersonalRoutes(router fiber.Router, mws ...fiber.Handler) {
	middleware.Get(router, "/alunos/:alunoId/progresso/exercicio/:exercicioId",
		mws, h.HistoricoExercicioDoAluno)
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

// ─── DTOs de saida ─────────────────────────────────────────────────────────

type historicoPontoDTO struct {
	SessaoID             uuid.UUID `json:"sessao_id"`
	DataExecucao         string    `json:"data_execucao"` // YYYY-MM-DD
	NumeroSerie          int       `json:"numero_serie"`
	CargaRealizada       *float64  `json:"carga_realizada,omitempty"`
	RepeticoesRealizadas *int      `json:"repeticoes_realizadas,omitempty"`
}

type historicoResponseDTO struct {
	AlunoID     uuid.UUID            `json:"aluno_id"`
	ExercicioID uuid.UUID            `json:"exercicio_id"`
	Pontos      []historicoPontoDTO  `json:"pontos"`
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

// ─── Helpers ───────────────────────────────────────────────────────────────

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
		errors.Is(err, domain.ErrExercicioNotFound):
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusNotFound, "not-found", "Not Found",
			"recurso nao encontrado",
		))
	}
	log.Error().Err(err).Str("path", c.Path()).Msg("progress handler error")
	return middleware.WriteProblem(c, middleware.NewProblem(
		fiber.StatusInternalServerError, "internal", "Internal Server Error",
		fallback,
	))
}
