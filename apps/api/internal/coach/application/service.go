// Package application contém os casos de uso do contexto Coach.
package application

import (
	"context"
	"fmt"
	"io"

	"github.com/amfit/api/internal/coach/domain"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

const (
	defaultPerPage = 20
	maxPerPage     = 100
)

// tiposVideoAceitos são os content-types aceitos para o clipe enviado pelo
// aluno — cobre os formatos nativos de gravação do iOS (quicktime) e
// Android (mp4).
var tiposVideoAceitos = map[string]bool{
	"video/mp4":       true,
	"video/quicktime": true,
}

// maxVideoBytes limita o tamanho do clipe — 60s de vídeo gravado num
// celular em qualidade razoável raramente passa de poucas dezenas de MB;
// 100MB dá margem sem deixar o bucket crescer sem controle.
const maxVideoBytes = 100 * 1024 * 1024

// VideoUpload encapsula o arquivo de vídeo recebido no multipart, análogo
// a application.LogoUpload em identity e application.MidiaUpload em catalog.
type VideoUpload struct {
	Filename    string
	ContentType string
	Size        int64
	Reader      io.Reader
}

// AlunoLookup é o port de cross-context com o Identity — mesmo padrão já
// usado em Execution/Training/Progress/Financial.
type AlunoLookup interface {
	BelongsToPersonal(ctx context.Context, alunoID, personalID uuid.UUID) (bool, error)

	// PersonalIDENome devolve o personal_id e o nome do aluno — usado pra
	// notificar o personal quando o aluno envia um vídeo (mesmo padrão de
	// execution's AlunoLookup.PersonalIDENome).
	PersonalIDENome(ctx context.Context, alunoID uuid.UUID) (personalID uuid.UUID, nome string, err error)
}

// VideoStorage é o port de infraestrutura com o object storage (MinIO).
type VideoStorage interface {
	UploadVideo(ctx context.Context, personalID, alunoID, videoID uuid.UUID, video *VideoUpload) (objectKey string, err error)
	PresignedURL(ctx context.Context, objectKey string) (string, error)
}

// Notifier é o port de cross-context com o Notification. Sem barramento de
// eventos (mesma estratégia do Execution/Financial) — o service chama esse
// port diretamente; falha de notificação nunca reverte nem falha o caso de
// uso principal.
type Notifier interface {
	NotificarCoachVideoEnviado(ctx context.Context, personalID uuid.UUID, alunoNome string) error
	NotificarCoachFeedbackEnviado(ctx context.Context, alunoID uuid.UUID) error
}

// CoachService implementa os casos de uso de vídeos e feedback do Coach.
type CoachService struct {
	videos    domain.CoachVideoRepository
	feedbacks domain.CoachVideoFeedbackRepository
	alunos    AlunoLookup
	storage   VideoStorage
	notifier  Notifier
}

// NewCoachService monta o service com as dependências fornecidas.
func NewCoachService(
	videos domain.CoachVideoRepository,
	feedbacks domain.CoachVideoFeedbackRepository,
	alunos AlunoLookup,
	storage VideoStorage,
	notifier Notifier,
) *CoachService {
	return &CoachService{
		videos:    videos,
		feedbacks: feedbacks,
		alunos:    alunos,
		storage:   storage,
		notifier:  notifier,
	}
}

// EnviarVideo processa o upload de um novo clipe (POST /coach/videos,
// role=ALUNO) e notifica o personal.
func (s *CoachService) EnviarVideo(
	ctx context.Context,
	alunoID uuid.UUID,
	req EnviarVideoRequest,
	video *VideoUpload,
) (*CoachVideoResponse, error) {
	if err := validarVideo(video); err != nil {
		return nil, err
	}

	personalID, alunoNome, err := s.alunos.PersonalIDENome(ctx, alunoID)
	if err != nil {
		return nil, fmt.Errorf("application: resolver personal do aluno: %w", err)
	}

	var itemTreinoID *uuid.UUID
	if req.ItemTreinoID != "" {
		id, err := uuid.Parse(req.ItemTreinoID)
		if err != nil {
			return nil, fmt.Errorf("application: item_treino_id invalido: %w", err)
		}
		itemTreinoID = &id
	}

	videoID := uuid.New()
	objectKey, err := s.storage.UploadVideo(ctx, personalID, alunoID, videoID, video)
	if err != nil {
		return nil, fmt.Errorf("application: upload video: %w", err)
	}

	v := &domain.CoachVideo{
		ID:              videoID,
		AlunoID:         alunoID,
		PersonalID:      personalID,
		ItemTreinoID:    itemTreinoID,
		VideoObjectKey:  objectKey,
		DuracaoSegundos: req.DuracaoSegundos,
		Status:          domain.StatusCoachVideoAguardandoFeedback,
		Descricao:       req.Descricao,
	}
	if err := s.videos.Create(ctx, v); err != nil {
		return nil, err
	}

	if err := s.notifier.NotificarCoachVideoEnviado(ctx, personalID, alunoNome); err != nil {
		log.Error().Err(err).Str("coach_video_id", v.ID.String()).Msg("coach: falha ao notificar personal")
	}

	resp, err := s.toResponse(ctx, &domain.CoachVideoComFeedback{CoachVideo: *v, AlunoNome: alunoNome})
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ListarMeusVideos lista os vídeos do próprio aluno autenticado
// (GET /alunos/me/coach/videos).
func (s *CoachService) ListarMeusVideos(ctx context.Context, alunoID uuid.UUID, page, perPage int) (*CoachVideoListResponse, error) {
	page, perPage = normalizarPaginacao(page, perPage)
	videos, total, err := s.videos.ListByAluno(ctx, alunoID, page, perPage)
	if err != nil {
		return nil, fmt.Errorf("application: listar meus videos: %w", err)
	}
	return s.toListResponse(ctx, videos, total, page, perPage)
}

// ListarVideosDoPersonal lista os vídeos dos alunos do personal
// (GET /coach/videos), opcionalmente filtrados por status.
func (s *CoachService) ListarVideosDoPersonal(
	ctx context.Context,
	personalID uuid.UUID,
	status *string,
	page, perPage int,
) (*CoachVideoListResponse, error) {
	page, perPage = normalizarPaginacao(page, perPage)

	var statusFiltro *domain.StatusCoachVideo
	if status != nil {
		s := domain.StatusCoachVideo(*status)
		statusFiltro = &s
	}

	videos, total, err := s.videos.ListByPersonal(ctx, personalID, statusFiltro, page, perPage)
	if err != nil {
		return nil, fmt.Errorf("application: listar videos do personal: %w", err)
	}
	return s.toListResponse(ctx, videos, total, page, perPage)
}

// ObterVideoDoPersonal devolve o detalhe de um vídeo (GET /coach/videos/{id},
// role=PERSONAL) — confirma que o vídeo pertence a um aluno do personal.
func (s *CoachService) ObterVideoDoPersonal(ctx context.Context, personalID, videoID uuid.UUID) (*CoachVideoResponse, error) {
	v, err := s.videos.FindComFeedback(ctx, videoID)
	if err != nil {
		return nil, fmt.Errorf("application: buscar video: %w", err)
	}
	if v == nil || v.PersonalID != personalID {
		return nil, domain.ErrCoachVideoNaoEncontrado
	}
	return s.toResponse(ctx, v)
}

// ObterMeuVideo devolve o detalhe de um vídeo do próprio aluno autenticado
// (GET /alunos/me/coach/videos/{id}).
func (s *CoachService) ObterMeuVideo(ctx context.Context, alunoID, videoID uuid.UUID) (*CoachVideoResponse, error) {
	v, err := s.videos.FindComFeedback(ctx, videoID)
	if err != nil {
		return nil, fmt.Errorf("application: buscar meu video: %w", err)
	}
	if v == nil || v.AlunoID != alunoID {
		return nil, domain.ErrCoachVideoNaoEncontrado
	}
	return s.toResponse(ctx, v)
}

// EnviarFeedback registra a resposta do personal a um vídeo
// (POST /coach/videos/{id}/feedback, role=PERSONAL) e notifica o aluno.
func (s *CoachService) EnviarFeedback(
	ctx context.Context,
	personalID, videoID uuid.UUID,
	req EnviarFeedbackRequest,
) (*CoachVideoResponse, error) {
	v, err := s.videos.FindComFeedback(ctx, videoID)
	if err != nil {
		return nil, fmt.Errorf("application: buscar video: %w", err)
	}
	if v == nil || v.PersonalID != personalID {
		return nil, domain.ErrCoachVideoNaoEncontrado
	}
	if v.Feedback != nil {
		return nil, domain.ErrCoachVideoJaTemFeedback
	}

	// MarcarFeedbackEnviado roda ANTES de criar o feedback (não depois) de
	// propósito — sem transação entre as duas escritas, se a segunda delas
	// falhar (timeout/erro transiente), a guarda `v.Feedback != nil` acima
	// precisa continuar deixando passar uma nova tentativa. Criar o
	// feedback primeiro e falhar ao marcar o status deixaria o vídeo preso
	// pra sempre (feedback já existe, guarda bloqueia todo retry, mas o
	// status nunca vira FEEDBACK_ENVIADO). Nesta ordem, o pior caso de uma
	// falha na criação é o personal reenviar o texto — um retry seguro.
	if err := s.videos.MarcarFeedbackEnviado(ctx, videoID); err != nil {
		return nil, fmt.Errorf("application: marcar feedback enviado: %w", err)
	}

	feedback := &domain.CoachVideoFeedback{
		ID:         uuid.New(),
		VideoID:    videoID,
		PersonalID: personalID,
		Texto:      req.Texto,
	}
	if err := s.feedbacks.Create(ctx, feedback); err != nil {
		return nil, fmt.Errorf("application: criar feedback: %w", err)
	}

	if err := s.notifier.NotificarCoachFeedbackEnviado(ctx, v.AlunoID); err != nil {
		log.Error().Err(err).Str("coach_video_id", videoID.String()).Msg("coach: falha ao notificar aluno")
	}

	v.Status = domain.StatusCoachVideoFeedbackEnviado
	v.Feedback = feedback
	return s.toResponse(ctx, v)
}

// ── helpers ──────────────────────────────────────────────────────────────

func validarVideo(video *VideoUpload) error {
	if !tiposVideoAceitos[video.ContentType] {
		return domain.ErrTipoVideoInvalido
	}
	if video.Size <= 0 || video.Size > maxVideoBytes {
		return domain.ErrVideoTamanhoExcedido
	}
	return nil
}

func normalizarPaginacao(page, perPage int) (int, int) {
	if page <= 0 {
		page = 1
	}
	if perPage <= 0 {
		perPage = defaultPerPage
	}
	if perPage > maxPerPage {
		perPage = maxPerPage
	}
	return page, perPage
}

func (s *CoachService) toResponse(ctx context.Context, v *domain.CoachVideoComFeedback) (*CoachVideoResponse, error) {
	url, err := s.storage.PresignedURL(ctx, v.VideoObjectKey)
	if err != nil {
		return nil, fmt.Errorf("application: gerar url do video: %w", err)
	}

	resp := &CoachVideoResponse{
		ID:              v.ID.String(),
		AlunoID:         v.AlunoID.String(),
		AlunoNome:       v.AlunoNome,
		ExercicioNome:   v.ExercicioNome,
		VideoURL:        url,
		DuracaoSegundos: v.DuracaoSegundos,
		Status:          string(v.Status),
		Descricao:       v.Descricao,
		CriadoEm:        v.CriadoEm,
	}
	if v.ItemTreinoID != nil {
		id := v.ItemTreinoID.String()
		resp.ItemTreinoID = &id
	}
	if v.Feedback != nil {
		resp.Feedback = &CoachVideoFeedbackResponse{
			Texto:     v.Feedback.Texto,
			EnviadoEm: v.Feedback.EnviadoEm,
		}
	}
	return resp, nil
}

func (s *CoachService) toListResponse(
	ctx context.Context,
	videos []*domain.CoachVideoComFeedback,
	total, page, perPage int,
) (*CoachVideoListResponse, error) {
	data := make([]CoachVideoResponse, 0, len(videos))
	for _, v := range videos {
		resp, err := s.toResponse(ctx, v)
		if err != nil {
			return nil, err
		}
		data = append(data, *resp)
	}
	return &CoachVideoListResponse{
		Data:       data,
		Pagination: Pagination{Total: total, Page: page, PerPage: perPage},
	}, nil
}
