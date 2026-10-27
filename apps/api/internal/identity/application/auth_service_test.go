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

// personalAtivo faz o repositorio devolver um personal ativo para qualquer id —
// o Refresh agora confere que o dono do token ainda existe e esta ativo.
func personalAtivo(personals *mockPersonalRepo) {
	personals.findByIDFn = func(_ context.Context, id uuid.UUID) (*domain.PersonalTrainer, error) {
		return &domain.PersonalTrainer{ID: id, Nome: "Foo", Ativo: true}, nil
	}
}

func TestLogin_ContaDesativada_RetornaInvalidCredentials(t *testing.T) {
	for _, tipo := range []string{"PERSONAL", "ALUNO"} {
		t.Run(tipo, func(t *testing.T) {
			svc, personals, alunos, creds, _ := newAuthServiceForTest(t)
			hash := fixedHash(t)
			id := uuid.New()

			personals.findByEmail = func(context.Context, string) (*domain.PersonalTrainer, error) {
				return &domain.PersonalTrainer{ID: id, Email: "x@x.com", Nome: "X", Ativo: false}, nil
			}
			alunos.findByEmailFn = func(context.Context, string) (*domain.Aluno, error) {
				return &domain.Aluno{ID: id, PersonalID: uuid.New(), Email: "x@x.com", Nome: "X", Ativo: false}, nil
			}
			creds.findByOwnerFn = func(_ context.Context, owner uuid.UUID, ot domain.OwnerType) (*domain.Credencial, error) {
				return &domain.Credencial{ID: uuid.New(), OwnerID: owner, OwnerType: ot, PasswordHash: hash}, nil
			}

			// Senha CORRETA: mesmo assim a conta desativada nao entra.
			_, err := svc.Login(context.Background(), LoginRequest{Email: "x@x.com", Senha: fixedPassword, Tipo: tipo})

			if !errors.Is(err, domain.ErrInvalidCredentials) {
				t.Fatalf("got %v, want ErrInvalidCredentials", err)
			}
		})
	}
}

func TestRefresh_DonoDesativadoOuInexistente_RetornaInvalidRefreshToken(t *testing.T) {
	casos := map[string]struct {
		role  domain.OwnerType
		setup func(*mockPersonalRepo, *mockAlunoRepo)
	}{
		"personal desativado": {domain.OwnerTypePersonal, func(p *mockPersonalRepo, _ *mockAlunoRepo) {
			p.findByIDFn = func(_ context.Context, id uuid.UUID) (*domain.PersonalTrainer, error) {
				return &domain.PersonalTrainer{ID: id, Ativo: false}, nil
			}
		}},
		"personal removido": {domain.OwnerTypePersonal, func(p *mockPersonalRepo, _ *mockAlunoRepo) {
			p.findByIDFn = func(context.Context, uuid.UUID) (*domain.PersonalTrainer, error) {
				return nil, domain.ErrPersonalNotFound
			}
		}},
		"aluno desativado": {domain.OwnerTypeAluno, func(_ *mockPersonalRepo, a *mockAlunoRepo) {
			a.findByIDFn = func(_ context.Context, id uuid.UUID) (*domain.Aluno, error) {
				return &domain.Aluno{ID: id, Ativo: false}, nil
			}
		}},
		"aluno removido": {domain.OwnerTypeAluno, func(_ *mockPersonalRepo, a *mockAlunoRepo) {
			a.findByIDFn = func(context.Context, uuid.UUID) (*domain.Aluno, error) {
				return nil, domain.ErrAlunoNotFound
			}
		}},
		"role desconhecido": {domain.OwnerType("ADMIN"), func(*mockPersonalRepo, *mockAlunoRepo) {}},
	}
	for nome, c := range casos {
		t.Run(nome, func(t *testing.T) {
			svc, personals, alunos, _, _ := newAuthServiceForTest(t)
			c.setup(personals, alunos)
			id := uuid.New()
			resp, err := svc.issueTokens(context.Background(), id, id, "Foo", c.role)
			if err != nil {
				t.Fatal(err)
			}

			_, err = svc.Refresh(context.Background(), resp.RefreshToken)

			if !errors.Is(err, domain.ErrInvalidRefreshToken) {
				t.Errorf("got %v, want ErrInvalidRefreshToken", err)
			}
		})
	}
}

func TestRefresh_TokenValido_RetornaNovoPar(t *testing.T) {
	svc, personals, _, _, refresh := newAuthServiceForTest(t)
	personalAtivo(personals)

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
	svc, personals, _, _, _ := newAuthServiceForTest(t)
	personalAtivo(personals)

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

func TestRegisterPersonal_GravaCodigoDeConviteValido(t *testing.T) {
	svc, personals, _, _, _ := newAuthServiceForTest(t)

	var gravado string
	personals.createFn = func(_ context.Context, pt *domain.PersonalTrainer) error {
		gravado = pt.Codigo
		return nil
	}

	if _, err := svc.RegisterPersonal(context.Background(), RegisterPersonalRequest{
		Nome: "Coach", Email: "novo@example.com", Senha: fixedPassword,
	}); err != nil {
		t.Fatalf("RegisterPersonal: %v", err)
	}
	if !domain.CodigoConviteValido(gravado) {
		t.Errorf("codigo gravado invalido: %q", gravado)
	}
}

func TestRegisterPersonal_ColisaoDeCodigo_SorteiaOutroETenta(t *testing.T) {
	svc, personals, _, _, _ := newAuthServiceForTest(t)

	var codigos []string
	personals.createFn = func(_ context.Context, pt *domain.PersonalTrainer) error {
		codigos = append(codigos, pt.Codigo)
		if len(codigos) < 3 {
			return domain.ErrCodigoEmUso
		}
		return nil
	}

	if _, err := svc.RegisterPersonal(context.Background(), RegisterPersonalRequest{
		Nome: "Coach", Email: "novo@example.com", Senha: fixedPassword,
	}); err != nil {
		t.Fatalf("RegisterPersonal deveria vencer a colisao, got %v", err)
	}
	if len(codigos) != 3 {
		t.Fatalf("esperadas 3 tentativas, got %d", len(codigos))
	}
	if codigos[0] == codigos[1] && codigos[1] == codigos[2] {
		t.Errorf("deveria sortear codigos diferentes a cada tentativa: %v", codigos)
	}
}

func TestRegisterPersonal_ColisaoPersistente_DesisteAposAsTentativas(t *testing.T) {
	svc, personals, _, _, _ := newAuthServiceForTest(t)

	tentativas := 0
	personals.createFn = func(context.Context, *domain.PersonalTrainer) error {
		tentativas++
		return domain.ErrCodigoEmUso
	}

	_, err := svc.RegisterPersonal(context.Background(), RegisterPersonalRequest{
		Nome: "Coach", Email: "novo@example.com", Senha: fixedPassword,
	})
	if !errors.Is(err, domain.ErrCodigoEmUso) {
		t.Fatalf("esperado ErrCodigoEmUso, got %v", err)
	}
	if tentativas != tentativasCodigoConvite {
		t.Errorf("esperadas %d tentativas, got %d", tentativasCodigoConvite, tentativas)
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
