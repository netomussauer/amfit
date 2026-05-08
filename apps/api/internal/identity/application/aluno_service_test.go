package application

import (
	"context"
	"errors"
	"testing"

	"github.com/amfit/api/internal/identity/domain"
	"github.com/google/uuid"
)

func newAlunoServiceForTest() (*AlunoService, *mockAlunoRepo, *mockCredencialRepo) {
	alunos := &mockAlunoRepo{}
	creds := &mockCredencialRepo{}
	return NewAlunoService(alunos, creds), alunos, creds
}

func TestCriarAluno_EmailDuplicado_RetornaErrEmailAlreadyExists(t *testing.T) {
	svc, alunos, _ := newAlunoServiceForTest()

	alunos.createFn = func(ctx context.Context, a *domain.Aluno) error {
		return domain.ErrEmailAlreadyExists
	}

	_, err := svc.CriarAluno(context.Background(), uuid.New(), CriarAlunoRequest{
		Nome:  "João",
		Email: "dup@example.com",
		Senha: fixedPassword,
	})
	if !errors.Is(err, domain.ErrEmailAlreadyExists) {
		t.Fatalf("expected ErrEmailAlreadyExists, got %v", err)
	}
}

func TestCriarAluno_Sucesso(t *testing.T) {
	svc, alunos, creds := newAlunoServiceForTest()

	personalID := uuid.New()
	createdAluno := false
	createdCred := false

	alunos.createFn = func(ctx context.Context, a *domain.Aluno) error {
		if a.PersonalID != personalID {
			t.Errorf("personal_id %v != %v", a.PersonalID, personalID)
		}
		createdAluno = true
		return nil
	}
	creds.createFn = func(ctx context.Context, c *domain.Credencial) error {
		if c.OwnerType != domain.OwnerTypeAluno {
			t.Errorf("owner_type esperado ALUNO, got %v", c.OwnerType)
		}
		createdCred = true
		return nil
	}

	resp, err := svc.CriarAluno(context.Background(), personalID, CriarAlunoRequest{
		Nome:           "Maria",
		Email:          "maria@example.com",
		Senha:          fixedPassword,
		DataNascimento: "1995-04-12",
		Sexo:           "F",
	})
	if err != nil {
		t.Fatalf("CriarAluno: %v", err)
	}
	if !createdAluno || !createdCred {
		t.Fatal("aluno e credencial não foram persistidos")
	}
	if resp.DataNascimento != "1995-04-12" {
		t.Errorf("data_nascimento %q != 1995-04-12", resp.DataNascimento)
	}
	if resp.Sexo != "F" {
		t.Errorf("sexo %q != F", resp.Sexo)
	}
}

func TestListarAlunos_FiltroPersonalIDPropagado(t *testing.T) {
	svc, alunos, _ := newAlunoServiceForTest()

	personalA := uuid.New()
	personalB := uuid.New()

	allAlunos := []*domain.Aluno{
		{ID: uuid.New(), PersonalID: personalA, Nome: "A1", Email: "a1@x.com", Ativo: true},
		{ID: uuid.New(), PersonalID: personalA, Nome: "A2", Email: "a2@x.com", Ativo: true},
		{ID: uuid.New(), PersonalID: personalB, Nome: "B1", Email: "b1@x.com", Ativo: true},
	}

	alunos.listByFn = func(ctx context.Context, personalID uuid.UUID, f domain.AlunoFilter) ([]*domain.Aluno, int, error) {
		// O repositório real filtra por personal_id; aqui simulamos.
		out := make([]*domain.Aluno, 0)
		for _, a := range allAlunos {
			if a.PersonalID == personalID {
				out = append(out, a)
			}
		}
		return out, len(out), nil
	}

	resp, err := svc.ListarAlunos(context.Background(), personalA, 1, 20, nil)
	if err != nil {
		t.Fatalf("ListarAlunos: %v", err)
	}
	if resp.Pagination.Total != 2 {
		t.Errorf("total esperado 2, got %d", resp.Pagination.Total)
	}
	if len(resp.Data) != 2 {
		t.Fatalf("data len esperado 2, got %d", len(resp.Data))
	}
	for _, a := range resp.Data {
		if a.Nome == "B1" {
			t.Errorf("aluno do personalB vazou para listagem do personalA")
		}
	}
}

func TestBuscarAluno_OutroPersonal_RetornaNotFound(t *testing.T) {
	svc, alunos, _ := newAlunoServiceForTest()

	personalA := uuid.New()
	personalB := uuid.New()
	alunoID := uuid.New()

	alunos.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.Aluno, error) {
		return &domain.Aluno{
			ID:         alunoID,
			PersonalID: personalB,
			Nome:       "Outro",
			Email:      "o@x.com",
			Ativo:      true,
		}, nil
	}

	_, err := svc.BuscarAluno(context.Background(), personalA, alunoID)
	if !errors.Is(err, domain.ErrAlunoNotFound) {
		t.Fatalf("expected ErrAlunoNotFound, got %v", err)
	}
}

func TestDesativarAluno_AplicaSoftDelete(t *testing.T) {
	svc, alunos, _ := newAlunoServiceForTest()

	personalID := uuid.New()
	alunoID := uuid.New()
	called := false

	alunos.findByIDFn = func(ctx context.Context, id uuid.UUID) (*domain.Aluno, error) {
		return &domain.Aluno{ID: alunoID, PersonalID: personalID, Ativo: true}, nil
	}
	alunos.deactivateFn = func(ctx context.Context, id uuid.UUID) error {
		if id != alunoID {
			t.Errorf("id %v != %v", id, alunoID)
		}
		called = true
		return nil
	}

	if err := svc.DesativarAluno(context.Background(), personalID, alunoID); err != nil {
		t.Fatalf("DesativarAluno: %v", err)
	}
	if !called {
		t.Fatal("Deactivate não foi chamado")
	}
}
