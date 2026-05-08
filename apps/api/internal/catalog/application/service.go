// Package application contém os casos de uso do contexto Catalog.
package application

import (
	"context"
	"fmt"
	"strings"

	"github.com/amfit/api/internal/catalog/domain"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// Limites de upload de mídia em bytes. Vídeos têm limite maior por natureza
// do conteúdo demonstrativo de exercícios; imagens/GIFs ficam mais restritos
// para preservar o orçamento de armazenamento do MinIO local.
const (
	maxImagemBytes = 5 * 1024 * 1024  // 5 MB para image/jpeg, image/png, image/gif
	maxVideoBytes  = 10 * 1024 * 1024 // 10 MB para video/mp4
)

// CatalogService implementa os casos de uso de gestão de exercícios e grupos.
type CatalogService struct {
	grupos     domain.GrupoMuscularRepository
	exercicios domain.ExercicioRepository
	storage    MidiaStorage
}

// NewCatalogService cria o CatalogService com as dependências fornecidas.
// storage pode ser nil em ambientes que não suportam upload — nesse caso
// CriarExercicio com mídia retornará erro.
func NewCatalogService(
	grupos domain.GrupoMuscularRepository,
	exercicios domain.ExercicioRepository,
	storage MidiaStorage,
) *CatalogService {
	return &CatalogService{
		grupos:     grupos,
		exercicios: exercicios,
		storage:    storage,
	}
}

// ListarGruposMusculares retorna a lista completa, ordenada por nome.
func (s *CatalogService) ListarGruposMusculares(ctx context.Context) (*GrupoMuscularListResponse, error) {
	rows, err := s.grupos.ListAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("application: list grupos musculares: %w", err)
	}

	out := make([]GrupoMuscularResponse, 0, len(rows))
	for _, g := range rows {
		out = append(out, GrupoMuscularResponse{
			ID:   g.ID.String(),
			Nome: g.Nome,
		})
	}
	return &GrupoMuscularListResponse{Data: out}, nil
}

// ListarExercicios retorna globais + os do personal autenticado, com filtros
// opcionais por grupo muscular e busca textual no nome.
func (s *CatalogService) ListarExercicios(
	ctx context.Context,
	params domain.ListExerciciosParams,
) (*ExercicioListResponse, error) {
	rows, err := s.exercicios.List(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("application: list exercicios: %w", err)
	}

	out := make([]ExercicioResponse, 0, len(rows))
	for _, e := range rows {
		out = append(out, exercicioToResponse(e))
	}
	return &ExercicioListResponse{Data: out}, nil
}

// BuscarExercicio retorna um exercício por ID. O personalID é usado apenas
// para autorização: globais são sempre visíveis; exercícios privados só são
// visíveis ao próprio dono.
func (s *CatalogService) BuscarExercicio(
	ctx context.Context,
	id, personalID uuid.UUID,
) (*ExercicioResponse, error) {
	ex, err := s.exercicios.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if ex.PersonalID != nil && *ex.PersonalID != personalID {
		return nil, domain.ErrExercicioNotFound
	}

	resp := exercicioToResponse(ex)
	return &resp, nil
}

// CriarExercicio persiste um novo exercício custom do personal informado e,
// caso uma mídia seja fornecida, faz upload para o MinIO antes de gravar a
// URL pública no registro.
func (s *CatalogService) CriarExercicio(
	ctx context.Context,
	personalID uuid.UUID,
	input CriarExercicioInput,
	midia *MidiaUpload,
) (*ExercicioResponse, error) {
	grupoID, err := uuid.Parse(input.GrupoMuscularID)
	if err != nil {
		return nil, fmt.Errorf("application: parse grupo_muscular_id: %w", err)
	}

	if _, err := s.grupos.FindByID(ctx, grupoID); err != nil {
		return nil, err
	}

	exID := uuid.New()
	ex := &domain.Exercicio{
		ID:              exID,
		PersonalID:      &personalID,
		Nome:            strings.TrimSpace(input.Nome),
		Descricao:       strings.TrimSpace(input.Descricao),
		GrupoMuscularID: grupoID,
		Ativo:           true,
	}

	if midia != nil {
		tipo, err := classificarMidia(midia.ContentType, midia.Size)
		if err != nil {
			return nil, err
		}
		if s.storage == nil {
			return nil, fmt.Errorf("application: storage de mídia não configurado")
		}

		url, err := s.storage.UploadMidia(ctx, exID, midia)
		if err != nil {
			return nil, fmt.Errorf("application: upload midia: %w", err)
		}
		ex.MidiaURL = url
		ex.TipoMidia = string(tipo)

		log.Info().
			Str("exercicio_id", exID.String()).
			Str("personal_id", personalID.String()).
			Str("tipo_midia", string(tipo)).
			Int64("tamanho_bytes", midia.Size).
			Msg("mídia de exercício enviada")
	}

	if err := s.exercicios.Create(ctx, ex); err != nil {
		return nil, fmt.Errorf("application: create exercicio: %w", err)
	}

	created, err := s.exercicios.FindByID(ctx, exID)
	if err != nil {
		return nil, fmt.Errorf("application: reload exercicio: %w", err)
	}

	log.Info().
		Str("exercicio_id", exID.String()).
		Str("personal_id", personalID.String()).
		Msg("exercício criado")

	resp := exercicioToResponse(created)
	return &resp, nil
}

// AtualizarExercicio aplica alterações nos campos não-nulos do request.
// Não permite editar exercícios globais ou de outros personals — em ambos
// os casos retorna ErrExercicioForbidden. Não troca a mídia (decisão Fase 1).
func (s *CatalogService) AtualizarExercicio(
	ctx context.Context,
	id, personalID uuid.UUID,
	input AtualizarExercicioInput,
) (*ExercicioResponse, error) {
	ex, err := s.exercicios.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if ex.PersonalID == nil || *ex.PersonalID != personalID {
		return nil, domain.ErrExercicioForbidden
	}

	if input.Nome != nil {
		ex.Nome = strings.TrimSpace(*input.Nome)
	}
	if input.Descricao != nil {
		ex.Descricao = strings.TrimSpace(*input.Descricao)
	}
	if input.GrupoMuscularID != nil {
		gid, err := uuid.Parse(*input.GrupoMuscularID)
		if err != nil {
			return nil, fmt.Errorf("application: parse grupo_muscular_id: %w", err)
		}
		if _, err := s.grupos.FindByID(ctx, gid); err != nil {
			return nil, err
		}
		ex.GrupoMuscularID = gid
	}

	if err := s.exercicios.Update(ctx, &ex.Exercicio); err != nil {
		return nil, fmt.Errorf("application: update exercicio: %w", err)
	}

	reloaded, err := s.exercicios.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("application: reload exercicio: %w", err)
	}

	resp := exercicioToResponse(reloaded)
	return &resp, nil
}

// DesativarExercicio aplica soft delete. Globais e de outros personals
// retornam ErrExercicioForbidden.
func (s *CatalogService) DesativarExercicio(
	ctx context.Context,
	id, personalID uuid.UUID,
) error {
	ex, err := s.exercicios.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if ex.PersonalID == nil || *ex.PersonalID != personalID {
		return domain.ErrExercicioForbidden
	}

	if err := s.exercicios.Deactivate(ctx, id, personalID); err != nil {
		return fmt.Errorf("application: deactivate exercicio: %w", err)
	}

	log.Info().
		Str("exercicio_id", id.String()).
		Str("personal_id", personalID.String()).
		Msg("exercício desativado")

	return nil
}

// ── Helpers ────────────────────────────────────────────────────────────────

// classificarMidia mapeia o content-type recebido para o enum tipo_midia,
// rejeitando tipos não suportados e tamanhos acima do limite por categoria.
func classificarMidia(contentType string, size int64) (domain.TipoMidia, error) {
	if size <= 0 {
		return "", domain.ErrTipoMidiaInvalido
	}

	ct := strings.ToLower(strings.TrimSpace(contentType))
	// Alguns clientes adicionam parâmetros como "image/jpeg; charset=binary".
	if i := strings.Index(ct, ";"); i >= 0 {
		ct = strings.TrimSpace(ct[:i])
	}

	switch ct {
	case "image/jpeg", "image/jpg", "image/png":
		if size > maxImagemBytes {
			return "", domain.ErrMidiaTamanhoExcedido
		}
		return domain.TipoMidiaImagem, nil
	case "image/gif":
		if size > maxImagemBytes {
			return "", domain.ErrMidiaTamanhoExcedido
		}
		return domain.TipoMidiaGIF, nil
	case "video/mp4":
		if size > maxVideoBytes {
			return "", domain.ErrMidiaTamanhoExcedido
		}
		return domain.TipoMidiaVideo, nil
	default:
		return "", domain.ErrTipoMidiaInvalido
	}
}

// exercicioToResponse converte ExercicioComGrupo no DTO de saída.
func exercicioToResponse(e *domain.ExercicioComGrupo) ExercicioResponse {
	return ExercicioResponse{
		ID:        e.ID.String(),
		Nome:      e.Nome,
		Descricao: e.Descricao,
		GrupoMuscular: GrupoMuscularResponse{
			ID:   e.GrupoMuscularID.String(),
			Nome: e.GrupoMuscularNome,
		},
		MidiaURL:  e.MidiaURL,
		TipoMidia: e.TipoMidia,
		IsGlobal:  e.IsGlobal(),
	}
}

