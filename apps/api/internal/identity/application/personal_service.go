package application

import (
	"context"
	"fmt"
	"strings"

	"github.com/amfit/api/internal/identity/domain"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"
)

// PersonalService implementa os casos de uso de autoatendimento do personal
// trainer sobre a própria conta (perfil e senha) — rotas /personal/me.
type PersonalService struct {
	personals     domain.PersonalTrainerRepository
	credenciais   domain.CredencialRepository
	refreshTokens domain.RefreshTokenRepository
}

// NewPersonalService cria o serviço com suas dependências.
func NewPersonalService(
	personals domain.PersonalTrainerRepository,
	credenciais domain.CredencialRepository,
	refreshTokens domain.RefreshTokenRepository,
) *PersonalService {
	return &PersonalService{
		personals:     personals,
		credenciais:   credenciais,
		refreshTokens: refreshTokens,
	}
}

// BuscarPersonalSelf retorna o perfil do personal autenticado.
func (s *PersonalService) BuscarPersonalSelf(ctx context.Context, personalID uuid.UUID) (*PersonalResponse, error) {
	pt, err := s.personals.FindByID(ctx, personalID)
	if err != nil {
		return nil, err
	}
	return personalToResponse(pt), nil
}

// AtualizarPersonal aplica as alterações nos campos não-nulos do request ao
// perfil do personal autenticado.
func (s *PersonalService) AtualizarPersonal(
	ctx context.Context,
	personalID uuid.UUID,
	req AtualizarPersonalRequest,
) (*PersonalResponse, error) {
	pt, err := s.personals.FindByID(ctx, personalID)
	if err != nil {
		return nil, err
	}

	if req.Nome != nil {
		pt.Nome = strings.TrimSpace(*req.Nome)
	}
	if req.Email != nil {
		pt.Email = strings.ToLower(strings.TrimSpace(*req.Email))
	}
	if req.Telefone != nil {
		pt.Telefone = strings.TrimSpace(*req.Telefone)
	}
	if req.CREF != nil {
		pt.CREF = strings.TrimSpace(*req.CREF)
	}

	if err := s.personals.Update(ctx, pt); err != nil {
		return nil, fmt.Errorf("application: update personal: %w", err)
	}

	return personalToResponse(pt), nil
}

// AlterarSenha troca a senha do personal autenticado, exigindo confirmação
// da senha atual antes de gravar o novo hash.
func (s *PersonalService) AlterarSenha(
	ctx context.Context,
	personalID uuid.UUID,
	req AlterarSenhaRequest,
) error {
	cred, err := s.credenciais.FindByOwner(ctx, personalID, domain.OwnerTypePersonal)
	if err != nil {
		return fmt.Errorf("application: find credencial: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(cred.PasswordHash), []byte(req.SenhaAtual)); err != nil {
		return domain.ErrSenhaAtualIncorreta
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NovaSenha), bcryptCost)
	if err != nil {
		return fmt.Errorf("application: hash password: %w", err)
	}

	if err := s.credenciais.UpdatePasswordHash(ctx, cred.ID, string(hash)); err != nil {
		return fmt.Errorf("application: update password hash: %w", err)
	}

	// Revoga sessões existentes (refresh tokens) para que um token vazado
	// pare de funcionar assim que a senha é trocada. Best-effort: a senha já
	// foi trocada com sucesso nesse ponto, então uma falha aqui não deve
	// fazer a operação inteira parecer ter falhado para o cliente (o que
	// levaria a um retry com a senha_atual antiga, que já não confere mais).
	if err := s.refreshTokens.RevokeAllByOwner(ctx, personalID); err != nil {
		log.Warn().Err(err).Str("personal_id", personalID.String()).Msg("failed to revoke refresh tokens after password change")
	}

	return nil
}

func personalToResponse(pt *domain.PersonalTrainer) *PersonalResponse {
	return &PersonalResponse{
		ID:       pt.ID.String(),
		Nome:     pt.Nome,
		Email:    pt.Email,
		Telefone: pt.Telefone,
		CREF:     pt.CREF,
		Ativo:    pt.Ativo,
		CriadoEm: pt.CriadoEm,
	}
}
