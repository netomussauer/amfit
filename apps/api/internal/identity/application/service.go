// Package application contém os casos de uso do contexto Identity.
package application

import (
	"crypto/rsa"

	"github.com/amfit/api/internal/identity/domain"
)

// IdentityService agrupa os casos de uso do contexto Identity.
// Atua como facade sobre AuthService e AlunoService para simplificar o wiring no main.go.
type IdentityService struct {
	Auth     *AuthService
	Aluno    *AlunoService
	Personal *PersonalService
	Tenant   *TenantService
}

// NewIdentityService cria um IdentityService com as dependências fornecidas.
func NewIdentityService(
	personals domain.PersonalTrainerRepository,
	alunos domain.AlunoRepository,
	credenciais domain.CredencialRepository,
	refreshTokens domain.RefreshTokenRepository,
	tenantConfigs domain.TenantConfigRepository,
	logoStorage LogoStorage,
	privateKey *rsa.PrivateKey,
	publicKey *rsa.PublicKey,
) *IdentityService {
	authSvc := NewAuthService(personals, alunos, credenciais, refreshTokens, privateKey, publicKey)
	alunoSvc := NewAlunoService(alunos, credenciais)
	personalSvc := NewPersonalService(personals, credenciais, refreshTokens)
	tenantSvc := NewTenantService(tenantConfigs, logoStorage)

	return &IdentityService{
		Auth:     authSvc,
		Aluno:    alunoSvc,
		Personal: personalSvc,
		Tenant:   tenantSvc,
	}
}
