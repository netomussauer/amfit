// Package application contém os casos de uso do contexto Identity.
package application

import "github.com/amfit/api/internal/identity/domain"

// IdentityService agrupa os casos de uso de autenticação e gestão de usuários.
// A implementação concreta é injetada via construtor.
type IdentityService struct {
	personals    domain.PersonalTrainerRepository
	alunos       domain.AlunoRepository
	credenciais  domain.CredencialRepository
	refreshTokens domain.RefreshTokenRepository
}

// NewIdentityService cria um IdentityService com as dependências fornecidas.
func NewIdentityService(
	personals domain.PersonalTrainerRepository,
	alunos domain.AlunoRepository,
	credenciais domain.CredencialRepository,
	refreshTokens domain.RefreshTokenRepository,
) *IdentityService {
	return &IdentityService{
		personals:    personals,
		alunos:       alunos,
		credenciais:  credenciais,
		refreshTokens: refreshTokens,
	}
}
