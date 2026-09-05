package application

import (
	"context"

	"github.com/amfit/api/internal/coach/domain"
	"github.com/google/uuid"
)

// ── CoachVideoRepository mock ───────────────────────────────────────────

type mockCoachVideoRepo struct {
	createFn                func(ctx context.Context, v *domain.CoachVideo) error
	findComFeedbackFn       func(ctx context.Context, id uuid.UUID) (*domain.CoachVideoComFeedback, error)
	listByPersonalFn        func(ctx context.Context, personalID uuid.UUID, status *domain.StatusCoachVideo, page, perPage int) ([]*domain.CoachVideoComFeedback, int, error)
	listByAlunoFn           func(ctx context.Context, alunoID uuid.UUID, page, perPage int) ([]*domain.CoachVideoComFeedback, int, error)
	marcarFeedbackEnviadoFn func(ctx context.Context, videoID uuid.UUID) error
}

func (m *mockCoachVideoRepo) Create(ctx context.Context, v *domain.CoachVideo) error {
	if m.createFn != nil {
		return m.createFn(ctx, v)
	}
	return nil
}

func (m *mockCoachVideoRepo) FindComFeedback(ctx context.Context, id uuid.UUID) (*domain.CoachVideoComFeedback, error) {
	if m.findComFeedbackFn != nil {
		return m.findComFeedbackFn(ctx, id)
	}
	return nil, nil
}

func (m *mockCoachVideoRepo) ListByPersonal(ctx context.Context, personalID uuid.UUID, status *domain.StatusCoachVideo, page, perPage int) ([]*domain.CoachVideoComFeedback, int, error) {
	if m.listByPersonalFn != nil {
		return m.listByPersonalFn(ctx, personalID, status, page, perPage)
	}
	return nil, 0, nil
}

func (m *mockCoachVideoRepo) ListByAluno(ctx context.Context, alunoID uuid.UUID, page, perPage int) ([]*domain.CoachVideoComFeedback, int, error) {
	if m.listByAlunoFn != nil {
		return m.listByAlunoFn(ctx, alunoID, page, perPage)
	}
	return nil, 0, nil
}

func (m *mockCoachVideoRepo) MarcarFeedbackEnviado(ctx context.Context, videoID uuid.UUID) error {
	if m.marcarFeedbackEnviadoFn != nil {
		return m.marcarFeedbackEnviadoFn(ctx, videoID)
	}
	return nil
}

// ── CoachVideoFeedbackRepository mock ───────────────────────────────────

type mockCoachVideoFeedbackRepo struct {
	createFn func(ctx context.Context, f *domain.CoachVideoFeedback) error
}

func (m *mockCoachVideoFeedbackRepo) Create(ctx context.Context, f *domain.CoachVideoFeedback) error {
	if m.createFn != nil {
		return m.createFn(ctx, f)
	}
	return nil
}

// ── AlunoLookup mock ─────────────────────────────────────────────────────

type mockAlunoLookup struct {
	belongsToPersonalFn func(ctx context.Context, alunoID, personalID uuid.UUID) (bool, error)
	personalIDENomeFn   func(ctx context.Context, alunoID uuid.UUID) (uuid.UUID, string, error)
}

func (m *mockAlunoLookup) BelongsToPersonal(ctx context.Context, alunoID, personalID uuid.UUID) (bool, error) {
	if m.belongsToPersonalFn != nil {
		return m.belongsToPersonalFn(ctx, alunoID, personalID)
	}
	return true, nil
}

func (m *mockAlunoLookup) PersonalIDENome(ctx context.Context, alunoID uuid.UUID) (uuid.UUID, string, error) {
	if m.personalIDENomeFn != nil {
		return m.personalIDENomeFn(ctx, alunoID)
	}
	return uuid.New(), "Aluno Teste", nil
}

// ── VideoStorage mock ────────────────────────────────────────────────────

type mockVideoStorage struct {
	uploadVideoFn  func(ctx context.Context, personalID, alunoID, videoID uuid.UUID, video *VideoUpload) (string, error)
	presignedURLFn func(ctx context.Context, objectKey string) (string, error)
}

func (m *mockVideoStorage) UploadVideo(ctx context.Context, personalID, alunoID, videoID uuid.UUID, video *VideoUpload) (string, error) {
	if m.uploadVideoFn != nil {
		return m.uploadVideoFn(ctx, personalID, alunoID, videoID, video)
	}
	return "coach-videos/" + personalID.String() + "/" + videoID.String() + ".mp4", nil
}

func (m *mockVideoStorage) PresignedURL(ctx context.Context, objectKey string) (string, error) {
	if m.presignedURLFn != nil {
		return m.presignedURLFn(ctx, objectKey)
	}
	return "https://minio.local/" + objectKey + "?presigned=1", nil
}

// ── Notifier mock ────────────────────────────────────────────────────────

type mockNotifier struct {
	notificarCoachVideoEnviadoFn    func(ctx context.Context, personalID uuid.UUID, alunoNome string) error
	notificarCoachFeedbackEnviadoFn func(ctx context.Context, alunoID uuid.UUID) error
}

func (m *mockNotifier) NotificarCoachVideoEnviado(ctx context.Context, personalID uuid.UUID, alunoNome string) error {
	if m.notificarCoachVideoEnviadoFn != nil {
		return m.notificarCoachVideoEnviadoFn(ctx, personalID, alunoNome)
	}
	return nil
}

func (m *mockNotifier) NotificarCoachFeedbackEnviado(ctx context.Context, alunoID uuid.UUID) error {
	if m.notificarCoachFeedbackEnviadoFn != nil {
		return m.notificarCoachFeedbackEnviadoFn(ctx, alunoID)
	}
	return nil
}
