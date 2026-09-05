// Package handlers contém os handlers HTTP do contexto Coach.
package handlers

import (
	"errors"
	"strconv"

	"github.com/amfit/api/internal/coach/application"
	"github.com/amfit/api/internal/coach/domain"
	"github.com/amfit/api/pkg/middleware"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// maxAbsoluteVideoUploadBytes é um teto absoluto verificado antes mesmo de
// abrir o arquivo — o limite "de negócio" (mais permissivo ou restritivo)
// fica no service (ver application.maxVideoBytes). Mesmo padrão de
// catalog/identity para upload de mídia.
const maxAbsoluteVideoUploadBytes = 150 * 1024 * 1024

// statusCoachVideoValidos é o whitelist usado para validar o filtro
// ?status= — sem essa checagem, um valor desconhecido só falharia lá na
// frente como erro de cast do Postgres, virando um 500 genérico em vez do
// 400 que um filtro inválido deveria devolver (mesmo achado de code-review
// já corrigido em financial/handlers/handler.go).
var statusCoachVideoValidos = map[string]bool{
	string(domain.StatusCoachVideoAguardandoFeedback): true,
	string(domain.StatusCoachVideoFeedbackEnviado):    true,
	string(domain.StatusCoachVideoArquivado):          true,
}

// CoachHandler expõe os endpoints de vídeos e feedback do Coach.
type CoachHandler struct {
	svc      *application.CoachService
	validate *validator.Validate
}

// NewCoachHandler cria o handler com o serviço injetado.
func NewCoachHandler(svc *application.CoachService) *CoachHandler {
	return &CoachHandler{
		svc:      svc,
		validate: validator.New(validator.WithRequiredStructEnabled()),
	}
}

// RegisterAlunoRoutes registra as rotas que o ALUNO consome para enviar
// vídeos e acompanhar o próprio feedback.
func (h *CoachHandler) RegisterAlunoRoutes(router fiber.Router, mws ...fiber.Handler) {
	middleware.Post(router, "/coach/videos", mws, h.EnviarVideo)
	middleware.Get(router, "/alunos/me/coach/videos", mws, h.ListarMeusVideos)
	middleware.Get(router, "/alunos/me/coach/videos/:id", mws, h.ObterMeuVideo)
}

// RegisterPersonalRoutes registra as rotas que o PERSONAL consome para
// revisar vídeos e enviar feedback.
func (h *CoachHandler) RegisterPersonalRoutes(router fiber.Router, mws ...fiber.Handler) {
	middleware.Get(router, "/coach/videos", mws, h.ListarVideosDoPersonal)
	middleware.Get(router, "/coach/videos/:id", mws, h.ObterVideoDoPersonal)
	middleware.Post(router, "/coach/videos/:id/feedback", mws, h.EnviarFeedback)
}

// ─── Aluno: enviar vídeo ────────────────────────────────────────────────

// EnviarVideo trata POST /coach/videos (role=ALUNO).
func (h *CoachHandler) EnviarVideo(c fiber.Ctx) error {
	alunoID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}

	form, err := c.MultipartForm()
	if err != nil {
		return badRequest(c, "corpo multipart invalido")
	}

	duracaoStr := firstFormValue(form.Value, "duracao_segundos")
	duracao, err := strconv.Atoi(duracaoStr)
	if err != nil {
		return badRequest(c, "duracao_segundos invalido")
	}

	req := application.EnviarVideoRequest{
		ItemTreinoID:    firstFormValue(form.Value, "item_treino_id"),
		Descricao:       firstFormValue(form.Value, "descricao"),
		DuracaoSegundos: duracao,
	}
	if !h.validateInput(c, &req) {
		return nil
	}

	files := form.File["video"]
	if len(files) == 0 {
		return badRequest(c, "arquivo de video obrigatorio")
	}
	header := files[0]
	if header.Size <= 0 {
		return badRequest(c, "arquivo de video vazio")
	}
	if header.Size > maxAbsoluteVideoUploadBytes {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusRequestEntityTooLarge, "payload-too-large", "Payload Too Large",
			"arquivo de video excede o limite",
		))
	}

	f, err := header.Open()
	if err != nil {
		return badRequest(c, "falha ao abrir arquivo de video")
	}
	defer f.Close()

	video := &application.VideoUpload{
		Filename:    header.Filename,
		ContentType: header.Header.Get("Content-Type"),
		Size:        header.Size,
		Reader:      f,
	}

	resp, err := h.svc.EnviarVideo(c.Context(), alunoID, req, video)
	if err != nil {
		return writeCoachError(c, err, "falha ao enviar video")
	}
	return c.Status(fiber.StatusCreated).JSON(resp)
}

// ListarMeusVideos trata GET /alunos/me/coach/videos (role=ALUNO).
func (h *CoachHandler) ListarMeusVideos(c fiber.Ctx) error {
	alunoID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	page, perPage := parsePaginacao(c)

	resp, err := h.svc.ListarMeusVideos(c.Context(), alunoID, page, perPage)
	if err != nil {
		return writeCoachError(c, err, "falha ao listar meus videos")
	}
	return c.JSON(resp)
}

// ObterMeuVideo trata GET /alunos/me/coach/videos/:id (role=ALUNO).
func (h *CoachHandler) ObterMeuVideo(c fiber.Ctx) error {
	alunoID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	videoID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badRequest(c, "id invalido")
	}

	resp, err := h.svc.ObterMeuVideo(c.Context(), alunoID, videoID)
	if err != nil {
		return writeCoachError(c, err, "falha ao buscar video")
	}
	return c.JSON(resp)
}

// ─── Personal: revisar e responder ──────────────────────────────────────

// ListarVideosDoPersonal trata GET /coach/videos (role=PERSONAL).
func (h *CoachHandler) ListarVideosDoPersonal(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	page, perPage := parsePaginacao(c)

	var status *string
	if v := c.Query("status", ""); v != "" {
		if !statusCoachVideoValidos[v] {
			return badRequest(c, "status invalido")
		}
		status = &v
	}

	resp, err := h.svc.ListarVideosDoPersonal(c.Context(), personalID, status, page, perPage)
	if err != nil {
		return writeCoachError(c, err, "falha ao listar videos")
	}
	return c.JSON(resp)
}

// ObterVideoDoPersonal trata GET /coach/videos/:id (role=PERSONAL).
func (h *CoachHandler) ObterVideoDoPersonal(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	videoID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badRequest(c, "id invalido")
	}

	resp, err := h.svc.ObterVideoDoPersonal(c.Context(), personalID, videoID)
	if err != nil {
		return writeCoachError(c, err, "falha ao buscar video")
	}
	return c.JSON(resp)
}

// EnviarFeedback trata POST /coach/videos/:id/feedback (role=PERSONAL).
func (h *CoachHandler) EnviarFeedback(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	videoID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badRequest(c, "id invalido")
	}

	var req application.EnviarFeedbackRequest
	if !h.bindAndValidate(c, &req) {
		return nil
	}

	resp, err := h.svc.EnviarFeedback(c.Context(), personalID, videoID, req)
	if err != nil {
		return writeCoachError(c, err, "falha ao enviar feedback")
	}
	return c.Status(fiber.StatusCreated).JSON(resp)
}

// ─── Helpers ────────────────────────────────────────────────────────────

// parsePaginacao nunca falha — page/per_page inválidos são silenciosamente
// ignorados (ficam nos defaults do service), mesmo comportamento de
// execution/handlers's paginationFromQuery e do fix aplicado em
// financial/handlers. Por isso devolve só (int, int), sem um terceiro
// retorno de erro que nunca seria preenchido.
func parsePaginacao(c fiber.Ctx) (int, int) {
	var page, perPage int
	if v := c.Query("page", ""); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			page = n
		}
	}
	if v := c.Query("per_page", ""); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			perPage = n
		}
	}
	return page, perPage
}

func firstFormValue(values map[string][]string, key string) string {
	if v, ok := values[key]; ok && len(v) > 0 {
		return v[0]
	}
	return ""
}

func (h *CoachHandler) bindAndValidate(c fiber.Ctx, dst any) bool {
	if err := c.Bind().Body(dst); err != nil {
		_ = middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"corpo da requisicao invalido",
		))
		return false
	}
	return h.validateInput(c, dst)
}

func (h *CoachHandler) validateInput(c fiber.Ctx, dst any) bool {
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
				Field:   fe.Field(),
				Message: fe.Tag(),
			})
		}
	}
	return p
}

func badRequest(c fiber.Ctx, msg string) error {
	return middleware.WriteProblem(c, middleware.NewProblem(
		fiber.StatusBadRequest, "bad-request", "Bad Request", msg,
	))
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

func writeCoachError(c fiber.Ctx, err error, fallback string) error {
	switch {
	case errors.Is(err, domain.ErrCoachVideoNaoEncontrado):
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusNotFound, "not-found", "Not Found", "recurso nao encontrado",
		))
	case errors.Is(err, domain.ErrCoachVideoJaTemFeedback):
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusConflict, "conflict", "Conflict", err.Error(),
		))
	case errors.Is(err, domain.ErrTipoVideoInvalido), errors.Is(err, domain.ErrVideoTamanhoExcedido),
		errors.Is(err, domain.ErrDuracaoInvalida), errors.Is(err, domain.ErrItemTreinoInvalido):
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusUnprocessableEntity, "validation", "Unprocessable Entity", err.Error(),
		))
	}
	log.Error().Err(err).Str("path", c.Path()).Msg("coach handler error")
	return middleware.WriteProblem(c, middleware.NewProblem(
		fiber.StatusInternalServerError, "internal", "Internal Server Error", fallback,
	))
}
