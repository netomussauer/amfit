package application

import (
	"context"
	"sync"
	"time"

	"github.com/amfit/api/internal/identity/domain"
	"github.com/google/uuid"
)

// ── Personal mock ──────────────────────────────────────────────────────────

type mockPersonalRepo struct {
	createFn    func(ctx context.Context, pt *domain.PersonalTrainer) error
	findByIDFn  func(ctx context.Context, id uuid.UUID) (*domain.PersonalTrainer, error)
	findByEmail func(ctx context.Context, email string) (*domain.PersonalTrainer, error)
	updateFn    func(ctx context.Context, pt *domain.PersonalTrainer) error
}

func (m *mockPersonalRepo) Create(ctx context.Context, pt *domain.PersonalTrainer) error {
	if m.createFn != nil {
		return m.createFn(ctx, pt)
	}
	return nil
}

func (m *mockPersonalRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.PersonalTrainer, error) {
	if m.findByIDFn != nil {
		return m.findByIDFn(ctx, id)
	}
	return nil, domain.ErrPersonalNotFound
}

func (m *mockPersonalRepo) FindByEmail(ctx context.Context, email string) (*domain.PersonalTrainer, error) {
	if m.findByEmail != nil {
		return m.findByEmail(ctx, email)
	}
	return nil, domain.ErrPersonalNotFound
}

func (m *mockPersonalRepo) Update(ctx context.Context, pt *domain.PersonalTrainer) error {
	if m.updateFn != nil {
		return m.updateFn(ctx, pt)
	}
	return nil
}

// ── Aluno mock ─────────────────────────────────────────────────────────────

type mockAlunoRepo struct {
	createFn      func(ctx context.Context, a *domain.Aluno) error
	findByIDFn    func(ctx context.Context, id uuid.UUID) (*domain.Aluno, error)
	findByEmailFn func(ctx context.Context, email string) (*domain.Aluno, error)
	listByFn      func(ctx context.Context, personalID uuid.UUID, f domain.AlunoFilter) ([]*domain.Aluno, int, error)
	updateFn      func(ctx context.Context, a *domain.Aluno) error
	deactivateFn  func(ctx context.Context, id uuid.UUID) error
}

func (m *mockAlunoRepo) Create(ctx context.Context, a *domain.Aluno) error {
	if m.createFn != nil {
		return m.createFn(ctx, a)
	}
	return nil
}

func (m *mockAlunoRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.Aluno, error) {
	if m.findByIDFn != nil {
		return m.findByIDFn(ctx, id)
	}
	return nil, domain.ErrAlunoNotFound
}

func (m *mockAlunoRepo) FindByEmail(ctx context.Context, email string) (*domain.Aluno, error) {
	if m.findByEmailFn != nil {
		return m.findByEmailFn(ctx, email)
	}
	return nil, domain.ErrAlunoNotFound
}

func (m *mockAlunoRepo) ListByPersonal(
	ctx context.Context,
	personalID uuid.UUID,
	f domain.AlunoFilter,
) ([]*domain.Aluno, int, error) {
	if m.listByFn != nil {
		return m.listByFn(ctx, personalID, f)
	}
	return nil, 0, nil
}

func (m *mockAlunoRepo) Update(ctx context.Context, a *domain.Aluno) error {
	if m.updateFn != nil {
		return m.updateFn(ctx, a)
	}
	return nil
}

func (m *mockAlunoRepo) Deactivate(ctx context.Context, id uuid.UUID) error {
	if m.deactivateFn != nil {
		return m.deactivateFn(ctx, id)
	}
	return nil
}

// ── Credencial mock ────────────────────────────────────────────────────────

type mockCredencialRepo struct {
	createFn       func(ctx context.Context, c *domain.Credencial) error
	findByOwnerFn  func(ctx context.Context, ownerID uuid.UUID, ot domain.OwnerType) (*domain.Credencial, error)
	updateHashFn   func(ctx context.Context, id uuid.UUID, hash string) error
	updateUltimoFn func(ctx context.Context, id uuid.UUID) error
}

func (m *mockCredencialRepo) Create(ctx context.Context, c *domain.Credencial) error {
	if m.createFn != nil {
		return m.createFn(ctx, c)
	}
	return nil
}

func (m *mockCredencialRepo) FindByOwner(
	ctx context.Context,
	ownerID uuid.UUID,
	ot domain.OwnerType,
) (*domain.Credencial, error) {
	if m.findByOwnerFn != nil {
		return m.findByOwnerFn(ctx, ownerID, ot)
	}
	return nil, domain.ErrInvalidCredentials
}

func (m *mockCredencialRepo) UpdatePasswordHash(ctx context.Context, id uuid.UUID, hash string) error {
	if m.updateHashFn != nil {
		return m.updateHashFn(ctx, id, hash)
	}
	return nil
}

func (m *mockCredencialRepo) UpdateUltimoAcesso(ctx context.Context, id uuid.UUID) error {
	if m.updateUltimoFn != nil {
		return m.updateUltimoFn(ctx, id)
	}
	return nil
}

// ── RefreshToken mock ──────────────────────────────────────────────────────

type mockRefreshTokenRepo struct {
	mu              sync.Mutex
	store           map[string]*domain.RefreshToken
	createFn        func(ctx context.Context, rt *domain.RefreshToken) error
	findByJTIFn     func(ctx context.Context, jti string) (*domain.RefreshToken, error)
	revokeByJTIFn   func(ctx context.Context, jti string) error
	revokeByOwnerFn func(ctx context.Context, ownerID uuid.UUID) error
}

func newMockRefreshRepo() *mockRefreshTokenRepo {
	return &mockRefreshTokenRepo{store: make(map[string]*domain.RefreshToken)}
}

func (m *mockRefreshTokenRepo) Create(ctx context.Context, rt *domain.RefreshToken) error {
	if m.createFn != nil {
		return m.createFn(ctx, rt)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	rt.CriadoEm = time.Now()
	cp := *rt
	m.store[rt.JTI] = &cp
	return nil
}

func (m *mockRefreshTokenRepo) FindByJTI(ctx context.Context, jti string) (*domain.RefreshToken, error) {
	if m.findByJTIFn != nil {
		return m.findByJTIFn(ctx, jti)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	rt, ok := m.store[jti]
	if !ok {
		return nil, domain.ErrInvalidRefreshToken
	}
	cp := *rt
	return &cp, nil
}

func (m *mockRefreshTokenRepo) RevokeByJTI(ctx context.Context, jti string) error {
	if m.revokeByJTIFn != nil {
		return m.revokeByJTIFn(ctx, jti)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	rt, ok := m.store[jti]
	if !ok {
		return domain.ErrInvalidRefreshToken
	}
	rt.Revogado = true
	return nil
}

func (m *mockRefreshTokenRepo) RevokeAllByOwner(ctx context.Context, ownerID uuid.UUID) error {
	if m.revokeByOwnerFn != nil {
		return m.revokeByOwnerFn(ctx, ownerID)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, rt := range m.store {
		if rt.OwnerID == ownerID {
			rt.Revogado = true
		}
	}
	return nil
}

// ── TenantConfig mock ──────────────────────────────────────────────────────

type mockTenantConfigRepo struct {
	findByPersonalIDFn func(ctx context.Context, personalID uuid.UUID) (*domain.TenantConfig, error)
	upsertFn           func(ctx context.Context, cfg *domain.TenantConfig) error
}

func (m *mockTenantConfigRepo) FindByPersonalID(
	ctx context.Context, personalID uuid.UUID,
) (*domain.TenantConfig, error) {
	if m.findByPersonalIDFn != nil {
		return m.findByPersonalIDFn(ctx, personalID)
	}
	return nil, nil
}

func (m *mockTenantConfigRepo) Upsert(ctx context.Context, cfg *domain.TenantConfig) error {
	if m.upsertFn != nil {
		return m.upsertFn(ctx, cfg)
	}
	return nil
}

// ── LogoStorage mock ───────────────────────────────────────────────────────

type mockLogoStorage struct {
	uploadLogoFn func(ctx context.Context, personalID uuid.UUID, logo *LogoUpload) (string, error)
}

func (m *mockLogoStorage) UploadLogo(
	ctx context.Context, personalID uuid.UUID, logo *LogoUpload,
) (string, error) {
	if m.uploadLogoFn != nil {
		return m.uploadLogoFn(ctx, personalID, logo)
	}
	return "https://minio.test/tenant-logos/" + personalID.String() + ".png", nil
}
