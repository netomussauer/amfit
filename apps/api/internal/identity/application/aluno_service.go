package application

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/amfit/api/internal/identity/domain"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"
)

const (
	defaultPage    = 1
	defaultPerPage = 20
	maxPerPage     = 100
)

// AlunoService implementa os casos de uso de gestão de alunos.
type AlunoService struct {
	alunos      domain.AlunoRepository
	credenciais domain.CredencialRepository
}

// NewAlunoService cria o serviço com suas dependências.
func NewAlunoService(alunos domain.AlunoRepository, credenciais domain.CredencialRepository) *AlunoService {
	return &AlunoService{
		alunos:      alunos,
		credenciais: credenciais,
	}
}

// CriarAluno cadastra um novo aluno vinculado ao personal autenticado.
func (s *AlunoService) CriarAluno(ctx context.Context, personalID uuid.UUID, req CriarAlunoRequest) (*AlunoResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Senha), bcryptCost)
	if err != nil {
		return nil, fmt.Errorf("application: hash password: %w", err)
	}

	aluno := &domain.Aluno{
		ID:         uuid.New(),
		PersonalID: personalID,
		Nome:       strings.TrimSpace(req.Nome),
		Email:      email,
		Telefone:   strings.TrimSpace(req.Telefone),
		Ativo:      true,
	}

	if req.DataNascimento != "" {
		t, err := time.Parse("2006-01-02", req.DataNascimento)
		if err != nil {
			return nil, fmt.Errorf("application: parse data_nascimento: %w", err)
		}
		aluno.DataNascimento = &t
	}
	if req.Sexo != "" {
		sx := domain.Sexo(req.Sexo)
		aluno.Sexo = &sx
	}

	if err := s.alunos.Create(ctx, aluno); err != nil {
		return nil, fmt.Errorf("application: create aluno: %w", err)
	}

	cred := &domain.Credencial{
		ID:           uuid.New(),
		OwnerID:      aluno.ID,
		OwnerType:    domain.OwnerTypeAluno,
		PasswordHash: string(hash),
	}
	if err := s.credenciais.Create(ctx, cred); err != nil {
		return nil, fmt.Errorf("application: create credencial: %w", err)
	}

	log.Info().
		Str("aluno_id", aluno.ID.String()).
		Str("personal_id", personalID.String()).
		Msg("aluno criado")

	return alunoToResponse(aluno), nil
}

// BuscarAluno retorna um aluno desde que pertença ao personal informado.
func (s *AlunoService) BuscarAluno(ctx context.Context, personalID, alunoID uuid.UUID) (*AlunoResponse, error) {
	aluno, err := s.alunos.FindByID(ctx, alunoID)
	if err != nil {
		return nil, err
	}
	if aluno.PersonalID != personalID {
		return nil, domain.ErrAlunoNotFound
	}
	return alunoToResponse(aluno), nil
}

// BuscarAlunoSelf retorna o próprio aluno (rota /alunos/me).
func (s *AlunoService) BuscarAlunoSelf(ctx context.Context, alunoID uuid.UUID) (*AlunoResponse, error) {
	aluno, err := s.alunos.FindByID(ctx, alunoID)
	if err != nil {
		return nil, err
	}
	return alunoToResponse(aluno), nil
}

// ListarAlunos retorna alunos do personal informado com paginação.
func (s *AlunoService) ListarAlunos(
	ctx context.Context,
	personalID uuid.UUID,
	page, perPage int,
	ativo *bool,
) (*AlunoListResponse, error) {
	if page < 1 {
		page = defaultPage
	}
	if perPage < 1 {
		perPage = defaultPerPage
	}
	if perPage > maxPerPage {
		perPage = maxPerPage
	}

	filter := domain.AlunoFilter{
		Ativo:   ativo,
		Page:    page,
		PerPage: perPage,
	}

	rows, total, err := s.alunos.ListByPersonal(ctx, personalID, filter)
	if err != nil {
		return nil, fmt.Errorf("application: list alunos: %w", err)
	}

	out := make([]AlunoResponse, 0, len(rows))
	for _, a := range rows {
		out = append(out, *alunoToResponse(a))
	}

	return &AlunoListResponse{
		Data: out,
		Pagination: Pagination{
			Total:   total,
			Page:    page,
			PerPage: perPage,
		},
	}, nil
}

// AtualizarAluno aplica as alterações nos campos não-nulos do request.
func (s *AlunoService) AtualizarAluno(
	ctx context.Context,
	personalID, alunoID uuid.UUID,
	req AtualizarAlunoRequest,
) (*AlunoResponse, error) {
	aluno, err := s.alunos.FindByID(ctx, alunoID)
	if err != nil {
		return nil, err
	}
	if aluno.PersonalID != personalID {
		return nil, domain.ErrAlunoNotFound
	}

	if req.Nome != nil {
		aluno.Nome = strings.TrimSpace(*req.Nome)
	}
	if req.Email != nil {
		aluno.Email = strings.ToLower(strings.TrimSpace(*req.Email))
	}
	if req.Telefone != nil {
		aluno.Telefone = strings.TrimSpace(*req.Telefone)
	}
	if req.DataNascimento != nil {
		if *req.DataNascimento == "" {
			aluno.DataNascimento = nil
		} else {
			t, err := time.Parse("2006-01-02", *req.DataNascimento)
			if err != nil {
				return nil, fmt.Errorf("application: parse data_nascimento: %w", err)
			}
			aluno.DataNascimento = &t
		}
	}
	if req.Sexo != nil {
		if *req.Sexo == "" {
			aluno.Sexo = nil
		} else {
			sx := domain.Sexo(*req.Sexo)
			aluno.Sexo = &sx
		}
	}

	if err := s.alunos.Update(ctx, aluno); err != nil {
		return nil, fmt.Errorf("application: update aluno: %w", err)
	}

	return alunoToResponse(aluno), nil
}

// DesativarAluno aplica soft delete (ativo=false).
func (s *AlunoService) DesativarAluno(ctx context.Context, personalID, alunoID uuid.UUID) error {
	aluno, err := s.alunos.FindByID(ctx, alunoID)
	if err != nil {
		return err
	}
	if aluno.PersonalID != personalID {
		return domain.ErrAlunoNotFound
	}
	if !aluno.Ativo {
		return nil
	}

	if err := s.alunos.Deactivate(ctx, alunoID); err != nil {
		return fmt.Errorf("application: deactivate aluno: %w", err)
	}
	return nil
}

func alunoToResponse(a *domain.Aluno) *AlunoResponse {
	resp := &AlunoResponse{
		ID:       a.ID.String(),
		Nome:     a.Nome,
		Email:    a.Email,
		Telefone: a.Telefone,
		Ativo:    a.Ativo,
		CriadoEm: a.CriadoEm,
	}
	if a.DataNascimento != nil {
		resp.DataNascimento = a.DataNascimento.Format("2006-01-02")
	}
	if a.Sexo != nil {
		resp.Sexo = string(*a.Sexo)
	}
	return resp
}
