package application

import (
	"context"
	"errors"
	"testing"

	"github.com/amfit/api/internal/identity/domain"
	"github.com/google/uuid"
)

func newPersonalServiceForTest() (*PersonalService, *mockPersonalRepo, *mockCredencialRepo, *mockRefreshTokenRepo) {
	personals := &mockPersonalRepo{}
	creds := &mockCredencialRepo{}
	refreshTokens := newMockRefreshRepo()
	return NewPersonalService(personals, creds, refreshTokens), personals, creds, refreshTokens
}

// ── BuscarPersonalSelf ───────────────────────────────────────────────────

func TestBuscarPersonalSelf_Sucesso_DevolvePerfil(t *testing.T) {
	svc, personals, _, _ := newPersonalServiceForTest()

	personalID := uuid.New()
	personals.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.PersonalTrainer, error) {
		if id != personalID {
			t.Errorf("FindByID: id esperado %v, got %v", personalID, id)
		}
		return &domain.PersonalTrainer{
			ID:    personalID,
			Nome:  "Ana",
			Email: "ana@example.com",
			Ativo: true,
		}, nil
	}

	resp, err := svc.BuscarPersonalSelf(context.Background(), personalID)
	if err != nil {
		t.Fatalf("BuscarPersonalSelf: %v", err)
	}
	if resp.Nome != "Ana" || resp.Email != "ana@example.com" {
		t.Errorf("resposta inesperada: %+v", resp)
	}
}

func TestBuscarPersonalSelf_NaoEncontrado_PropagaErro(t *testing.T) {
	svc, personals, _, _ := newPersonalServiceForTest()

	personals.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.PersonalTrainer, error) {
		return nil, domain.ErrPersonalNotFound
	}

	_, err := svc.BuscarPersonalSelf(context.Background(), uuid.New())
	if !errors.Is(err, domain.ErrPersonalNotFound) {
		t.Fatalf("esperado ErrPersonalNotFound, got %v", err)
	}
}

// ── AtualizarPersonal ────────────────────────────────────────────────────

func TestAtualizarPersonal_CamposParciais_AplicaSomenteOsInformados(t *testing.T) {
	svc, personals, _, _ := newPersonalServiceForTest()

	personalID := uuid.New()
	original := &domain.PersonalTrainer{
		ID:       personalID,
		Nome:     "Ana Original",
		Email:    "ana@example.com",
		Telefone: "11999990000",
		CREF:     "123456-G/SP",
		Ativo:    true,
	}
	personals.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.PersonalTrainer, error) {
		return original, nil
	}

	var updated *domain.PersonalTrainer
	personals.updateFn = func(ctx context.Context, pt *domain.PersonalTrainer) error {
		updated = pt
		return nil
	}

	novoNome := "Ana Atualizada"
	resp, err := svc.AtualizarPersonal(context.Background(), personalID, AtualizarPersonalRequest{
		Nome: &novoNome,
	})
	if err != nil {
		t.Fatalf("AtualizarPersonal: %v", err)
	}
	if resp.Nome != "Ana Atualizada" {
		t.Errorf("nome esperado 'Ana Atualizada', got %q", resp.Nome)
	}
	if resp.Email != "ana@example.com" {
		t.Errorf("email não deveria mudar, got %q", resp.Email)
	}
	if updated == nil {
		t.Fatal("Update não foi chamado")
	}
	if updated.Telefone != "11999990000" || updated.CREF != "123456-G/SP" {
		t.Errorf("campos não informados foram alterados: %+v", updated)
	}
}

func TestAtualizarPersonal_EmailNormalizado(t *testing.T) {
	svc, personals, _, _ := newPersonalServiceForTest()

	personalID := uuid.New()
	personals.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.PersonalTrainer, error) {
		return &domain.PersonalTrainer{ID: personalID, Nome: "Ana", Email: "old@example.com"}, nil
	}
	personals.updateFn = func(ctx context.Context, pt *domain.PersonalTrainer) error {
		return nil
	}

	novoEmail := "  NOVO@Example.com  "
	resp, err := svc.AtualizarPersonal(context.Background(), personalID, AtualizarPersonalRequest{
		Email: &novoEmail,
	})
	if err != nil {
		t.Fatalf("AtualizarPersonal: %v", err)
	}
	if resp.Email != "novo@example.com" {
		t.Errorf("email esperado normalizado 'novo@example.com', got %q", resp.Email)
	}
}

func TestAtualizarPersonal_EmailDuplicado_RetornaErrEmailAlreadyExists(t *testing.T) {
	svc, personals, _, _ := newPersonalServiceForTest()

	personalID := uuid.New()
	personals.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.PersonalTrainer, error) {
		return &domain.PersonalTrainer{ID: personalID, Nome: "Ana", Email: "ana@example.com"}, nil
	}
	personals.updateFn = func(ctx context.Context, pt *domain.PersonalTrainer) error {
		return domain.ErrEmailAlreadyExists
	}

	emailDup := "dup@example.com"
	_, err := svc.AtualizarPersonal(context.Background(), personalID, AtualizarPersonalRequest{
		Email: &emailDup,
	})
	if !errors.Is(err, domain.ErrEmailAlreadyExists) {
		t.Fatalf("esperado ErrEmailAlreadyExists, got %v", err)
	}
}

func TestAtualizarPersonal_NaoEncontrado_PropagaErro(t *testing.T) {
	svc, personals, _, _ := newPersonalServiceForTest()

	personals.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.PersonalTrainer, error) {
		return nil, domain.ErrPersonalNotFound
	}

	nome := "X"
	_, err := svc.AtualizarPersonal(context.Background(), uuid.New(), AtualizarPersonalRequest{Nome: &nome})
	if !errors.Is(err, domain.ErrPersonalNotFound) {
		t.Fatalf("esperado ErrPersonalNotFound, got %v", err)
	}
}

// ── AlterarSenha ─────────────────────────────────────────────────────────

func TestAlterarSenha_SenhaAtualCorreta_AtualizaHashERevogaTokens(t *testing.T) {
	svc, _, creds, refreshTokens := newPersonalServiceForTest()

	personalID := uuid.New()
	credID := uuid.New()
	creds.findByOwnerFn = func(ctx context.Context, ownerID uuid.UUID, ot domain.OwnerType) (*domain.Credencial, error) {
		if ownerID != personalID || ot != domain.OwnerTypePersonal {
			t.Errorf("FindByOwner: argumentos inesperados (%v, %v)", ownerID, ot)
		}
		return &domain.Credencial{ID: credID, OwnerID: ownerID, OwnerType: ot, PasswordHash: fixedHash(t)}, nil
	}

	var novoHash string
	creds.updateHashFn = func(ctx context.Context, id uuid.UUID, hash string) error {
		if id != credID {
			t.Errorf("UpdatePasswordHash: id esperado %v, got %v", credID, id)
		}
		novoHash = hash
		return nil
	}

	var revogouOwnerID uuid.UUID
	revogouChamado := false
	refreshTokens.revokeByOwnerFn = func(ctx context.Context, ownerID uuid.UUID) error {
		revogouChamado = true
		revogouOwnerID = ownerID
		return nil
	}

	err := svc.AlterarSenha(context.Background(), personalID, AlterarSenhaRequest{
		SenhaAtual: fixedPassword,
		NovaSenha:  "NovaSenha456!",
	})
	if err != nil {
		t.Fatalf("AlterarSenha: %v", err)
	}
	if novoHash == "" {
		t.Fatal("UpdatePasswordHash não foi chamado")
	}
	if novoHash == fixedHash(t) {
		t.Error("hash não foi alterado")
	}
	if !revogouChamado {
		t.Fatal("RevokeAllByOwner não foi chamado — sessões existentes (refresh tokens) continuariam válidas após a troca de senha")
	}
	if revogouOwnerID != personalID {
		t.Errorf("RevokeAllByOwner: owner_id esperado %v, got %v", personalID, revogouOwnerID)
	}
}

func TestAlterarSenha_SenhaAtualIncorreta_NaoAtualizaHashNemRevogaTokens(t *testing.T) {
	svc, _, creds, refreshTokens := newPersonalServiceForTest()

	creds.findByOwnerFn = func(ctx context.Context, ownerID uuid.UUID, ot domain.OwnerType) (*domain.Credencial, error) {
		return &domain.Credencial{PasswordHash: fixedHash(t)}, nil
	}
	chamouUpdate := false
	creds.updateHashFn = func(ctx context.Context, id uuid.UUID, hash string) error {
		chamouUpdate = true
		return nil
	}
	chamouRevoke := false
	refreshTokens.revokeByOwnerFn = func(ctx context.Context, ownerID uuid.UUID) error {
		chamouRevoke = true
		return nil
	}

	err := svc.AlterarSenha(context.Background(), uuid.New(), AlterarSenhaRequest{
		SenhaAtual: "SenhaErrada123!",
		NovaSenha:  "NovaSenha456!",
	})
	if !errors.Is(err, domain.ErrSenhaAtualIncorreta) {
		t.Fatalf("esperado ErrSenhaAtualIncorreta, got %v", err)
	}
	if chamouUpdate {
		t.Error("UpdatePasswordHash não deveria ter sido chamado")
	}
	if chamouRevoke {
		t.Error("RevokeAllByOwner não deveria ter sido chamado")
	}
}

func TestAlterarSenha_CredencialNaoEncontrada_PropagaErro(t *testing.T) {
	svc, _, creds, _ := newPersonalServiceForTest()

	creds.findByOwnerFn = func(ctx context.Context, ownerID uuid.UUID, ot domain.OwnerType) (*domain.Credencial, error) {
		return nil, domain.ErrInvalidCredentials
	}

	err := svc.AlterarSenha(context.Background(), uuid.New(), AlterarSenhaRequest{
		SenhaAtual: fixedPassword,
		NovaSenha:  "NovaSenha456!",
	})
	if !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Fatalf("esperado ErrInvalidCredentials, got %v", err)
	}
}
