package application

import (
	"context"
	"crypto/rsa"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/amfit/api/internal/identity/domain"
	"github.com/amfit/api/pkg/auth"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"
)

const (
	accessTokenTTLSeconds = 15 * 60
	refreshTokenTTL       = 30 * 24 * time.Hour
	bcryptCost            = 10
)

// AuthService implementa os casos de uso de autenticação.
type AuthService struct {
	personals     domain.PersonalTrainerRepository
	alunos        domain.AlunoRepository
	credenciais   domain.CredencialRepository
	refreshTokens domain.RefreshTokenRepository
	privateKey    *rsa.PrivateKey
	publicKey     *rsa.PublicKey
}

// NewAuthService cria o serviço de autenticação com suas dependências.
func NewAuthService(
	personals domain.PersonalTrainerRepository,
	alunos domain.AlunoRepository,
	credenciais domain.CredencialRepository,
	refreshTokens domain.RefreshTokenRepository,
	privateKey *rsa.PrivateKey,
	publicKey *rsa.PublicKey,
) *AuthService {
	return &AuthService{
		personals:     personals,
		alunos:        alunos,
		credenciais:   credenciais,
		refreshTokens: refreshTokens,
		privateKey:    privateKey,
		publicKey:     publicKey,
	}
}

// RegisterPersonal cria um novo personal trainer e devolve o par de tokens autenticado.
func (s *AuthService) RegisterPersonal(ctx context.Context, req RegisterPersonalRequest) (*AuthResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Senha), bcryptCost)
	if err != nil {
		return nil, fmt.Errorf("application: hash password: %w", err)
	}

	personal := &domain.PersonalTrainer{
		ID:       uuid.New(),
		Nome:     strings.TrimSpace(req.Nome),
		Email:    email,
		Telefone: strings.TrimSpace(req.Telefone),
		CREF:     strings.TrimSpace(req.CREF),
		Ativo:    true,
	}

	if err := s.personals.Create(ctx, personal); err != nil {
		return nil, fmt.Errorf("application: create personal: %w", err)
	}

	cred := &domain.Credencial{
		ID:           uuid.New(),
		OwnerID:      personal.ID,
		OwnerType:    domain.OwnerTypePersonal,
		PasswordHash: string(hash),
	}
	if err := s.credenciais.Create(ctx, cred); err != nil {
		return nil, fmt.Errorf("application: create credencial: %w", err)
	}

	log.Info().
		Str("personal_id", personal.ID.String()).
		Str("email", personal.Email).
		Msg("personal registered")

	return s.issueTokens(ctx, personal.ID, personal.ID, personal.Nome, domain.OwnerTypePersonal)
}

// Login autentica um personal ou aluno comparando o hash de senha.
// Retorna ErrInvalidCredentials para email inexistente ou senha errada
// (mesmo erro evita user enumeration).
func (s *AuthService) Login(ctx context.Context, req LoginRequest) (*AuthResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	tipo := domain.OwnerType(req.Tipo)

	var ownerID, tenantID uuid.UUID
	var nome string
	var ownerType domain.OwnerType

	switch tipo {
	case domain.OwnerTypePersonal:
		pt, err := s.personals.FindByEmail(ctx, email)
		if err != nil {
			if errors.Is(err, domain.ErrPersonalNotFound) {
				return nil, domain.ErrInvalidCredentials
			}
			return nil, fmt.Errorf("application: find personal: %w", err)
		}
		ownerID = pt.ID
		tenantID = pt.ID
		nome = pt.Nome
		ownerType = domain.OwnerTypePersonal

	case domain.OwnerTypeAluno:
		al, err := s.alunos.FindByEmail(ctx, email)
		if err != nil {
			if errors.Is(err, domain.ErrAlunoNotFound) {
				return nil, domain.ErrInvalidCredentials
			}
			return nil, fmt.Errorf("application: find aluno: %w", err)
		}
		ownerID = al.ID
		tenantID = al.PersonalID
		nome = al.Nome
		ownerType = domain.OwnerTypeAluno

	default:
		return nil, domain.ErrInvalidCredentials
	}

	cred, err := s.credenciais.FindByOwner(ctx, ownerID, ownerType)
	if err != nil {
		return nil, fmt.Errorf("application: find credencial: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(cred.PasswordHash), []byte(req.Senha)); err != nil {
		return nil, domain.ErrInvalidCredentials
	}

	if err := s.credenciais.UpdateUltimoAcesso(ctx, cred.ID); err != nil {
		log.Warn().Err(err).Str("credencial_id", cred.ID.String()).Msg("failed to update ultimo_acesso")
	}

	log.Info().
		Str("user_id", ownerID.String()).
		Str("role", string(ownerType)).
		Msg("login success")

	return s.issueTokens(ctx, ownerID, tenantID, nome, ownerType)
}

// Refresh valida o refresh token, revoga o antigo e emite um novo par (rotation pattern).
func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (*AuthResponse, error) {
	claims, err := auth.VerifyToken(refreshToken, s.publicKey)
	if err != nil {
		return nil, domain.ErrInvalidRefreshToken
	}

	jti, _ := claims["jti"].(string)
	subStr, _ := claims["sub"].(string)
	tenantStr, _ := claims["tenant_id"].(string)
	role, _ := claims["role"].(string)
	nome, _ := claims["name"].(string)

	if jti == "" || subStr == "" || role == "" {
		return nil, domain.ErrInvalidRefreshToken
	}

	stored, err := s.refreshTokens.FindByJTI(ctx, jti)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidRefreshToken) {
			return nil, domain.ErrInvalidRefreshToken
		}
		return nil, fmt.Errorf("application: find refresh token: %w", err)
	}

	if stored.Revogado {
		return nil, domain.ErrRefreshTokenRevoked
	}
	if stored.IsExpired(time.Now()) {
		return nil, domain.ErrInvalidRefreshToken
	}

	if err := s.refreshTokens.RevokeByJTI(ctx, jti); err != nil {
		return nil, fmt.Errorf("application: revoke old refresh: %w", err)
	}

	ownerID, err := uuid.Parse(subStr)
	if err != nil {
		return nil, domain.ErrInvalidRefreshToken
	}

	tenantID := ownerID
	if tenantStr != "" {
		if parsed, perr := uuid.Parse(tenantStr); perr == nil {
			tenantID = parsed
		}
	}

	return s.issueTokens(ctx, ownerID, tenantID, nome, domain.OwnerType(role))
}

// Logout revoga o refresh token correspondente ao JTI fornecido.
func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	claims, err := auth.VerifyToken(refreshToken, s.publicKey)
	if err != nil {
		return domain.ErrInvalidRefreshToken
	}
	jti, _ := claims["jti"].(string)
	if jti == "" {
		return domain.ErrInvalidRefreshToken
	}

	if err := s.refreshTokens.RevokeByJTI(ctx, jti); err != nil {
		return fmt.Errorf("application: revoke jti: %w", err)
	}
	return nil
}

// issueTokens gera o par access/refresh, persiste o refresh token e devolve o AuthResponse.
func (s *AuthService) issueTokens(
	ctx context.Context,
	ownerID, tenantID uuid.UUID,
	nome string,
	ownerType domain.OwnerType,
) (*AuthResponse, error) {
	accessJTI := uuid.NewString()
	refreshJTI := uuid.NewString()

	accessClaims := jwt.MapClaims{
		"sub":       ownerID.String(),
		"role":      string(ownerType),
		"tenant_id": tenantID.String(),
		"jti":       accessJTI,
		"name":      nome,
	}
	accessToken, err := auth.SignToken(accessClaims, s.privateKey)
	if err != nil {
		return nil, fmt.Errorf("application: sign access: %w", err)
	}

	refreshClaims := jwt.MapClaims{
		"sub":       ownerID.String(),
		"role":      string(ownerType),
		"tenant_id": tenantID.String(),
		"jti":       refreshJTI,
		"name":      nome,
		"typ":       "refresh",
	}
	refreshToken, err := auth.SignRefreshToken(refreshClaims, s.privateKey, refreshTokenTTL)
	if err != nil {
		return nil, fmt.Errorf("application: sign refresh: %w", err)
	}

	rt := &domain.RefreshToken{
		ID:       uuid.New(),
		OwnerID:  ownerID,
		JTI:      refreshJTI,
		ExpiraEm: time.Now().Add(refreshTokenTTL),
	}
	if err := s.refreshTokens.Create(ctx, rt); err != nil {
		return nil, fmt.Errorf("application: persist refresh: %w", err)
	}

	return &AuthResponse{
		AccessToken:  accessToken,
		TokenType:    "Bearer",
		ExpiresIn:    accessTokenTTLSeconds,
		RefreshToken: refreshToken,
		Usuario: UsuarioBasic{
			ID:   ownerID.String(),
			Nome: nome,
			Role: string(ownerType),
		},
	}, nil
}
