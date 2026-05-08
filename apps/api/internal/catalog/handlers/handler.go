// Package handlers contém os handlers HTTP do contexto Catalog.
package handlers

import (
	"errors"
	"strings"

	"github.com/amfit/api/internal/catalog/application"
	"github.com/amfit/api/internal/catalog/domain"
	"github.com/amfit/api/pkg/middleware"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// rolePersonal é o claim role esperado para operações de escrita no catalog.
const rolePersonal = "PERSONAL"

// CatalogHandler expõe os endpoints de exercícios e grupos musculares.
type CatalogHandler struct {
	svc      *application.CatalogService
	validate *validator.Validate
}

// NewCatalogHandler cria o handler com o serviço injetado.
func NewCatalogHandler(svc *application.CatalogService) *CatalogHandler {
	return &CatalogHandler{
		svc:      svc,
		validate: validator.New(validator.WithRequiredStructEnabled()),
	}
}

// Register monta todas as rotas do contexto Catalog. As rotas de leitura são
// acessíveis a qualquer role autenticado; as de escrita exigem PERSONAL.
//
// O agrupamento por sub-router (router.Group) garante que o middleware de
// RequireRole se aplica somente às rotas mutáveis, mantendo /grupos-musculares
// e /exercicios (GET) abertas a ALUNO.
func (h *CatalogHandler) Register(router fiber.Router) {
	// Leitura: PERSONAL e ALUNO podem ler.
	router.Get("/grupos-musculares", h.ListarGruposMusculares)
	router.Get("/exercicios", h.ListarExercicios)
	router.Get("/exercicios/:id", h.BuscarExercicio)

	// Escrita: somente PERSONAL.
	personalOnly := router.Group("", middleware.RequireRole(rolePersonal))
	personalOnly.Post("/exercicios", h.CriarExercicio)
	personalOnly.Patch("/exercicios/:id", h.AtualizarExercicio)
	personalOnly.Delete("/exercicios/:id", h.DesativarExercicio)
}

// ── Grupos Musculares ──────────────────────────────────────────────────────

// ListarGruposMusculares trata GET /grupos-musculares.
// Retorna array direto (sem wrapper { data }) — endpoint sem paginação
// e consumido como lookup simples por web e mobile.
func (h *CatalogHandler) ListarGruposMusculares(c fiber.Ctx) error {
	resp, err := h.svc.ListarGruposMusculares(c.Context())
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao listar grupos musculares",
		))
	}
	return c.JSON(resp.Data)
}

// ── Exercícios ─────────────────────────────────────────────────────────────

// ListarExercicios trata GET /exercicios.
//
// Para roles diferentes (PERSONAL ou ALUNO) o personal_id usado no filtro de
// visibilidade vem de fontes distintas:
//
//   - PERSONAL: o próprio sub do JWT é o owner.
//   - ALUNO:    usa-se o tenant_id do JWT (o personal vinculado ao aluno),
//     garantindo que o aluno só veja exercícios do seu personal + globais.
func (h *CatalogHandler) ListarExercicios(c fiber.Ctx) error {
	personalID, ok := personalIDForList(c)
	if !ok {
		return nil
	}

	params := domain.ListExerciciosParams{
		PersonalID: personalID,
		Busca:      strings.TrimSpace(c.Query("busca", "")),
	}

	if v := c.Query("grupo_muscular_id", ""); v != "" {
		gid, err := uuid.Parse(v)
		if err != nil {
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusBadRequest, "bad-request", "Bad Request",
				"grupo_muscular_id inválido",
			))
		}
		params.GrupoMuscularID = &gid
	}

	resp, err := h.svc.ListarExercicios(c.Context(), params)
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao listar exercícios",
		))
	}
	return c.JSON(resp)
}

// BuscarExercicio trata GET /exercicios/:id.
func (h *CatalogHandler) BuscarExercicio(c fiber.Ctx) error {
	personalID, ok := personalIDForList(c)
	if !ok {
		return nil
	}

	exID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"id inválido",
		))
	}

	resp, err := h.svc.BuscarExercicio(c.Context(), exID, personalID)
	if err != nil {
		if errors.Is(err, domain.ErrExercicioNotFound) {
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusNotFound, "not-found", "Not Found",
				"exercício não encontrado",
			))
		}
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao buscar exercício",
		))
	}
	return c.JSON(resp)
}

// CriarExercicio trata POST /exercicios (multipart/form-data).
func (h *CatalogHandler) CriarExercicio(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}

	form, err := c.MultipartForm()
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"corpo multipart inválido",
		))
	}

	input := application.CriarExercicioInput{
		Nome:            firstFormValue(form.Value, "nome"),
		Descricao:       firstFormValue(form.Value, "descricao"),
		GrupoMuscularID: firstFormValue(form.Value, "grupo_muscular_id"),
	}

	if !h.validateInput(c, &input) {
		return nil
	}

	var midia *application.MidiaUpload
	if files := form.File["midia"]; len(files) > 0 {
		header := files[0]

		// Validações de tamanho/tipo são aplicadas no service, mas validamos
		// aqui um teto absoluto para evitar abrir arquivos enormes.
		if header.Size <= 0 {
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusBadRequest, "bad-request", "Bad Request",
				"arquivo de mídia vazio",
			))
		}
		if header.Size > maxAbsoluteUploadBytes {
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusRequestEntityTooLarge, "payload-too-large", "Payload Too Large",
				"arquivo de mídia excede o limite",
			))
		}

		f, err := header.Open()
		if err != nil {
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusBadRequest, "bad-request", "Bad Request",
				"falha ao abrir arquivo de mídia",
			))
		}
		defer f.Close()

		midia = &application.MidiaUpload{
			Filename:    header.Filename,
			ContentType: header.Header.Get("Content-Type"),
			Size:        header.Size,
			Reader:      f,
		}
	}

	resp, err := h.svc.CriarExercicio(c.Context(), personalID, input, midia)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrTipoMidiaInvalido):
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusUnsupportedMediaType, "unsupported-media-type", "Unsupported Media Type",
				"tipo de mídia não suportado (use jpeg, png, gif ou mp4)",
			))
		case errors.Is(err, domain.ErrMidiaTamanhoExcedido):
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusRequestEntityTooLarge, "payload-too-large", "Payload Too Large",
				"tamanho da mídia excede o limite",
			))
		case errors.Is(err, domain.ErrGrupoMuscularNotFound):
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusUnprocessableEntity, "validation", "Unprocessable Entity",
				"grupo muscular não encontrado",
			))
		}
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao criar exercício",
		))
	}
	return c.Status(fiber.StatusCreated).JSON(resp)
}

// AtualizarExercicio trata PATCH /exercicios/:id (JSON, sem upload de mídia).
func (h *CatalogHandler) AtualizarExercicio(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	exID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"id inválido",
		))
	}

	var input application.AtualizarExercicioInput
	if !h.bindAndValidate(c, &input) {
		return nil
	}

	resp, err := h.svc.AtualizarExercicio(c.Context(), exID, personalID, input)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrExercicioNotFound):
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusNotFound, "not-found", "Not Found",
				"exercício não encontrado",
			))
		case errors.Is(err, domain.ErrExercicioForbidden):
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusForbidden, "forbidden", "Forbidden",
				"não é possível alterar este exercício",
			))
		case errors.Is(err, domain.ErrGrupoMuscularNotFound):
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusUnprocessableEntity, "validation", "Unprocessable Entity",
				"grupo muscular não encontrado",
			))
		}
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao atualizar exercício",
		))
	}
	return c.JSON(resp)
}

// DesativarExercicio trata DELETE /exercicios/:id (soft delete).
func (h *CatalogHandler) DesativarExercicio(c fiber.Ctx) error {
	personalID, ok := userIDFromCtx(c)
	if !ok {
		return nil
	}
	exID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusBadRequest, "bad-request", "Bad Request",
			"id inválido",
		))
	}

	if err := h.svc.DesativarExercicio(c.Context(), exID, personalID); err != nil {
		switch {
		case errors.Is(err, domain.ErrExercicioNotFound):
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusNotFound, "not-found", "Not Found",
				"exercício não encontrado",
			))
		case errors.Is(err, domain.ErrExercicioForbidden):
			return middleware.WriteProblem(c, middleware.NewProblem(
				fiber.StatusForbidden, "forbidden", "Forbidden",
				"não é possível desativar este exercício",
			))
		}
		return middleware.WriteProblem(c, middleware.NewProblem(
			fiber.StatusInternalServerError, "internal", "Internal Server Error",
			"falha ao desativar exercício",
		))
	}
	return c.SendStatus(fiber.StatusNoContent)
}
