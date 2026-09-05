package application

import (
	"bytes"
	"context"
	"testing"

	"github.com/amfit/api/internal/coach/domain"
	"github.com/google/uuid"
)

func newCoachServiceForTest() (*CoachService, *mockCoachVideoRepo, *mockCoachVideoFeedbackRepo, *mockAlunoLookup, *mockVideoStorage, *mockNotifier) {
	videos := &mockCoachVideoRepo{}
	feedbacks := &mockCoachVideoFeedbackRepo{}
	alunos := &mockAlunoLookup{}
	storage := &mockVideoStorage{}
	notifier := &mockNotifier{}
	return NewCoachService(videos, feedbacks, alunos, storage, notifier), videos, feedbacks, alunos, storage, notifier
}

func validVideoUpload() *VideoUpload {
	return &VideoUpload{
		Filename:    "clipe.mp4",
		ContentType: "video/mp4",
		Size:        1024,
		Reader:      bytes.NewReader([]byte("fake video bytes")),
	}
}

// ── EnviarVideo ──────────────────────────────────────────────────────────

func TestEnviarVideo_TipoInvalido_DevolveErro(t *testing.T) {
	svc, _, _, _, _, _ := newCoachServiceForTest()

	upload := validVideoUpload()
	upload.ContentType = "application/pdf"

	_, err := svc.EnviarVideo(context.Background(), uuid.New(), EnviarVideoRequest{DuracaoSegundos: 30}, upload)
	if err != domain.ErrTipoVideoInvalido {
		t.Fatalf("esperado ErrTipoVideoInvalido, got %v", err)
	}
}

func TestEnviarVideo_TamanhoExcedido_DevolveErro(t *testing.T) {
	svc, _, _, _, _, _ := newCoachServiceForTest()

	upload := validVideoUpload()
	upload.Size = maxVideoBytes + 1

	_, err := svc.EnviarVideo(context.Background(), uuid.New(), EnviarVideoRequest{DuracaoSegundos: 30}, upload)
	if err != domain.ErrVideoTamanhoExcedido {
		t.Fatalf("esperado ErrVideoTamanhoExcedido, got %v", err)
	}
}

func TestEnviarVideo_Sucesso_CriaComStatusAguardandoFeedbackENotificaPersonal(t *testing.T) {
	svc, videos, _, alunos, storage, notifier := newCoachServiceForTest()
	personalID := uuid.New()
	alunos.personalIDENomeFn = func(ctx context.Context, alunoID uuid.UUID) (uuid.UUID, string, error) {
		return personalID, "João Aluno", nil
	}
	var salvo *domain.CoachVideo
	videos.createFn = func(ctx context.Context, v *domain.CoachVideo) error {
		salvo = v
		return nil
	}
	var notificouPersonal uuid.UUID
	var notificouNome string
	notifier.notificarCoachVideoEnviadoFn = func(ctx context.Context, pID uuid.UUID, nome string) error {
		notificouPersonal = pID
		notificouNome = nome
		return nil
	}

	resp, err := svc.EnviarVideo(context.Background(), uuid.New(), EnviarVideoRequest{
		DuracaoSegundos: 45, Descricao: "revisar postura",
	}, validVideoUpload())
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if salvo.Status != domain.StatusCoachVideoAguardandoFeedback {
		t.Errorf("esperado status AGUARDANDO_FEEDBACK, got %s", salvo.Status)
	}
	if salvo.PersonalID != personalID {
		t.Errorf("personal_id incorreto: %v", salvo.PersonalID)
	}
	if resp.VideoURL == "" {
		t.Errorf("esperado video_url preenchida")
	}
	if notificouPersonal != personalID || notificouNome != "João Aluno" {
		t.Errorf("notificacao incorreta: personal=%v nome=%v", notificouPersonal, notificouNome)
	}
	_ = storage
}

func TestEnviarVideo_ItemTreinoIDInvalido_DevolveErro(t *testing.T) {
	svc, _, _, _, _, _ := newCoachServiceForTest()

	_, err := svc.EnviarVideo(context.Background(), uuid.New(), EnviarVideoRequest{
		DuracaoSegundos: 30, ItemTreinoID: "nao-e-um-uuid",
	}, validVideoUpload())
	if err == nil {
		t.Fatal("esperado erro para item_treino_id malformado")
	}
}

// ── EnviarFeedback ───────────────────────────────────────────────────────

func TestEnviarFeedback_VideoNaoEncontrado_DevolveErro(t *testing.T) {
	svc, videos, _, _, _, _ := newCoachServiceForTest()
	videos.findComFeedbackFn = func(ctx context.Context, id uuid.UUID) (*domain.CoachVideoComFeedback, error) {
		return nil, nil
	}

	_, err := svc.EnviarFeedback(context.Background(), uuid.New(), uuid.New(), EnviarFeedbackRequest{Texto: "boa execução"})
	if err != domain.ErrCoachVideoNaoEncontrado {
		t.Fatalf("esperado ErrCoachVideoNaoEncontrado, got %v", err)
	}
}

func TestEnviarFeedback_DeOutroPersonal_DevolveNaoEncontrado(t *testing.T) {
	svc, videos, _, _, _, _ := newCoachServiceForTest()
	videos.findComFeedbackFn = func(ctx context.Context, id uuid.UUID) (*domain.CoachVideoComFeedback, error) {
		return &domain.CoachVideoComFeedback{CoachVideo: domain.CoachVideo{ID: id, PersonalID: uuid.New()}}, nil
	}

	_, err := svc.EnviarFeedback(context.Background(), uuid.New(), uuid.New(), EnviarFeedbackRequest{Texto: "boa execução"})
	if err != domain.ErrCoachVideoNaoEncontrado {
		t.Fatalf("esperado ErrCoachVideoNaoEncontrado, got %v", err)
	}
}

func TestEnviarFeedback_VideoJaTemFeedback_DevolveErro(t *testing.T) {
	svc, videos, _, _, _, _ := newCoachServiceForTest()
	personalID := uuid.New()
	videos.findComFeedbackFn = func(ctx context.Context, id uuid.UUID) (*domain.CoachVideoComFeedback, error) {
		return &domain.CoachVideoComFeedback{
			CoachVideo: domain.CoachVideo{ID: id, PersonalID: personalID},
			Feedback:   &domain.CoachVideoFeedback{ID: uuid.New()},
		}, nil
	}

	_, err := svc.EnviarFeedback(context.Background(), personalID, uuid.New(), EnviarFeedbackRequest{Texto: "boa execução"})
	if err != domain.ErrCoachVideoJaTemFeedback {
		t.Fatalf("esperado ErrCoachVideoJaTemFeedback, got %v", err)
	}
}

func TestEnviarFeedback_Sucesso_MarcaEnviadoENotificaAluno(t *testing.T) {
	svc, videos, feedbacks, _, _, notifier := newCoachServiceForTest()
	personalID := uuid.New()
	alunoID := uuid.New()
	videoID := uuid.New()
	videos.findComFeedbackFn = func(ctx context.Context, id uuid.UUID) (*domain.CoachVideoComFeedback, error) {
		return &domain.CoachVideoComFeedback{
			CoachVideo: domain.CoachVideo{ID: id, PersonalID: personalID, AlunoID: alunoID},
		}, nil
	}
	var feedbackSalvo *domain.CoachVideoFeedback
	feedbacks.createFn = func(ctx context.Context, f *domain.CoachVideoFeedback) error {
		feedbackSalvo = f
		return nil
	}
	marcouEnviado := false
	videos.marcarFeedbackEnviadoFn = func(ctx context.Context, id uuid.UUID) error {
		marcouEnviado = true
		return nil
	}
	notificouAluno := uuid.Nil
	notifier.notificarCoachFeedbackEnviadoFn = func(ctx context.Context, id uuid.UUID) error {
		notificouAluno = id
		return nil
	}

	resp, err := svc.EnviarFeedback(context.Background(), personalID, videoID, EnviarFeedbackRequest{Texto: "boa execução, ajuste o cotovelo"})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if feedbackSalvo.Texto != "boa execução, ajuste o cotovelo" {
		t.Errorf("texto do feedback incorreto: %q", feedbackSalvo.Texto)
	}
	if !marcouEnviado {
		t.Error("esperado MarcarFeedbackEnviado chamado")
	}
	if notificouAluno != alunoID {
		t.Errorf("esperado notificar aluno %v, got %v", alunoID, notificouAluno)
	}
	if resp.Status != string(domain.StatusCoachVideoFeedbackEnviado) {
		t.Errorf("esperado status FEEDBACK_ENVIADO no response, got %s", resp.Status)
	}
	if resp.Feedback == nil || resp.Feedback.Texto != "boa execução, ajuste o cotovelo" {
		t.Errorf("esperado feedback no response, got %+v", resp.Feedback)
	}
}

// ── ObterVideoDoPersonal / ObterMeuVideo ─────────────────────────────────

func TestObterVideoDoPersonal_DeOutroPersonal_DevolveNaoEncontrado(t *testing.T) {
	svc, videos, _, _, _, _ := newCoachServiceForTest()
	videos.findComFeedbackFn = func(ctx context.Context, id uuid.UUID) (*domain.CoachVideoComFeedback, error) {
		return &domain.CoachVideoComFeedback{CoachVideo: domain.CoachVideo{ID: id, PersonalID: uuid.New()}}, nil
	}

	_, err := svc.ObterVideoDoPersonal(context.Background(), uuid.New(), uuid.New())
	if err != domain.ErrCoachVideoNaoEncontrado {
		t.Fatalf("esperado ErrCoachVideoNaoEncontrado, got %v", err)
	}
}

func TestObterMeuVideo_DeOutroAluno_DevolveNaoEncontrado(t *testing.T) {
	svc, videos, _, _, _, _ := newCoachServiceForTest()
	videos.findComFeedbackFn = func(ctx context.Context, id uuid.UUID) (*domain.CoachVideoComFeedback, error) {
		return &domain.CoachVideoComFeedback{CoachVideo: domain.CoachVideo{ID: id, AlunoID: uuid.New()}}, nil
	}

	_, err := svc.ObterMeuVideo(context.Background(), uuid.New(), uuid.New())
	if err != domain.ErrCoachVideoNaoEncontrado {
		t.Fatalf("esperado ErrCoachVideoNaoEncontrado, got %v", err)
	}
}
