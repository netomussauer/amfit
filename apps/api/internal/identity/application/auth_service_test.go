package application

import (
	"context"
	"errors"
	"testing"

	"github.com/amfit/api/internal/identity/domain"
	"github.com/google/uuid"
)

func newAuthServiceForTest(t *testing.T) (
	*AuthService,
	*mockPersonalRepo,
	*mockAlunoRepo,
	*mockCredencialRepo,
	*mockRefreshTokenRepo,
) {
	t.Helper()
	priv, pub := testKeys(t)

	personals := &mockPersonalRepo{}
	alunos := &mockAlunoRepo{}
	creds := &mockCredencialRepo{}
	refresh := newMockRefreshRepo()

	svc := NewAuthService(personals, alunos, creds, refresh, priv, pub)
	return svc, personals, alunos, creds, refresh
}

func TestLogin_PersonalSucesso(t *testing.T) {
	svc, personals, _, creds, _ := newAuthServiceForTest(t)

	pt := &domain.PersonalTrainer{
		ID:    uuid.New(),
		Nome:  "Coach",
		Email: "coach@example.com",
		Ativo: true,
	}
	hash := fixedHash(t)

	personals.findByEmail = func(ctx context.Context, email string) (*domain.PersonalTrainer, error) {
		if email != "coach@example.com" {
			return nil, domain.ErrPersonalNotFound
		}
		return pt, nil
	}

	creds.findByOwnerFn = func(ctx context.Context, ownerID uuid.UUID, ot domain.OwnerType) (*domain.Credencial, error) {
		if ownerID != pt.ID || ot != domain.OwnerTypePersonal {
			return nil, domain.ErrInvalidCredentials
		}
		return &domain.Credencial{
			ID:           uuid.New(),
			OwnerID:      pt.ID,
			OwnerType:    domain.OwnerTypePersonal,
			PasswordHash: hash,
		}, nil
	}

	resp, err := svc.Login(context.Background(), LoginRequest{
		Email: "coach@example.com",
		Senha: fixedPassword,
		Tipo:  "PERSONAL",
	})
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if resp.AccessToken == "" || resp.RefreshToken == "" {
		t.Fatal("access/refresh token vazio")
	}
	if resp.Usuario.Role != "PERSONAL" {
		t.Errorf("role esperada PERSONAL, recebida %q", resp.Usuario.Role)
	}
	if resp.Usuario.ID != pt.ID.String() {
		t.Errorf("usuario.id %q != %q", resp.Usuario.ID, pt.ID.String())
	}
}

func TestLogin_SenhaErrada_RetornaInvalidCredentials(t *testing.T) {
	svc, personals, _, creds, _ := newAuthServiceForTest(t)

	pt := &domain.PersonalTrainer{ID: uuid.New(), Email: "x@x.com", Ativo: true, Nome: "X"}
	hash := fixedHash(t)

	personals.findByEmail = func(ctx context.Context, email string) (*domain.PersonalTrainer, error) {
		return pt, nil
	}
	creds.findByOwnerFn = func(ctx context.Context, ownerID uuid.UUID, ot domain.OwnerType) (*domain.Credencial, error) {
		return &domain.Credencial{ID: uuid.New(), OwnerID: pt.ID, OwnerType: ot, PasswordHash: hash}, nil
	}

	_, err := svc.Login(context.Background(), LoginRequest{
		Email: "x@x.com",
		Senha: "WrongPassword!",
		Tipo:  "PERSONAL",
	})
	if !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Fatalf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestLogin_EmailInexistente_RetornaInvalidCredentials(t *testing.T) {
	svc, personals, _, _, _ := newAuthServiceForTest(t)

	personals.findByEmail = func(ctx context.Context, email string) (*domain.PersonalTrainer, error) {
		return nil, domain.ErrPersonalNotFound
	}

	_, err := svc.Login(context.Background(), LoginRequest{
		Email: "ghost@example.com",
		Senha: fixedPassword,
		Tipo:  "PERSONAL",
	})
	if !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Fatalf("expected ErrInvalidCredentials (sem user enumeration), got %v", err)
	}
}

func TestRefresh_TokenValido_RetornaNovoPar(t *testing.T) {
	svc, _, _, _, refresh := newAuthServiceForTest(t)

	// Emite um par via login simulado (chamando issueTokens diretamente).
	ownerID := uuid.New()
	resp, err := svc.issueTokens(context.Background(), ownerID, ownerID, "Foo", domain.OwnerTypePersonal)
	if err != nil {
		t.Fatalf("issueTokens: %v", err)
	}
	originalRefresh := resp.RefreshToken

	// O refresh foi armazenado em memória; aplica o refresh.
	newResp, err := svc.Refresh(context.Background(), originalRefresh)
	if err != nil {
		t.Fatalf("Refresh: %v", err)
	}
	if newResp.AccessToken == "" || newResp.RefreshToken == "" {
		t.Fatal("novo par vazio")
	}
	if newResp.RefreshToken == originalRefresh {
		t.Fatal("rotation não ocorreu — refresh token igual ao anterior")
	}

	// O store deve conter pelo menos 2 entradas: o original (revogado) e o novo.
	if len(refresh.store) < 2 {
		t.Fatalf("esperado 2 entradas no store após rotation, encontrou %d", len(refresh.store))
	}
	revogados := 0
	ativos := 0
	for _, rt := range refresh.store {
		if rt.Revogado {
			revogados++
		} else {
			ativos++
		}
	}
	if revogados < 1 || ativos < 1 {
		t.Errorf("esperado >=1 revogado e >=1 ativo, got revogados=%d ativos=%d", revogados, ativos)
	}
}

func TestRefresh_TokenRevogado_RetornaErro(t *testing.T) {
	svc, _, _, _, _ := newAuthServiceForTest(t)

	ownerID := uuid.New()
	resp, err := svc.issueTokens(context.Background(), ownerID, ownerID, "Foo", domain.OwnerTypePersonal)
	if err != nil {
		t.Fatalf("issueTokens: %v", err)
	}

	// Primeiro refresh: ok.
	if _, err := svc.Refresh(context.Background(), resp.RefreshToken); err != nil {
		t.Fatalf("primeiro refresh: %v", err)
	}

	// Segundo refresh com o mesmo token: deve falhar (revogado).
	_, err = svc.Refresh(context.Background(), resp.RefreshToken)
	if !errors.Is(err, domain.ErrRefreshTokenRevoked) {
		t.Fatalf("expected ErrRefreshTokenRevoked, got %v", err)
	}
}

func TestRegisterPersonal_PropagaErroEmailExistente(t *testing.T) {
	svc, personals, _, _, _ := newAuthServiceForTest(t)

	personals.createFn = func(ctx context.Context, pt *domain.PersonalTrainer) error {
		return domain.ErrEmailAlreadyExists
	}

	_, err := svc.RegisterPersonal(context.Background(), RegisterPersonalRequest{
		Nome:  "Coach",
		Email: "dup@example.com",
		Senha: fixedPassword,
	})
	if !errors.Is(err, domain.ErrEmailAlreadyExists) {
		t.Fatalf("expected ErrEmailAlreadyExists, got %v", err)
	}
}
