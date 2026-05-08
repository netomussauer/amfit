// Package domain define as entidades e tipos do contexto Identity.
package domain

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

// OwnerType distingue o tipo de dono de uma credencial.
type OwnerType string

const (
	OwnerTypePersonal OwnerType = "PERSONAL"
	OwnerTypeAluno    OwnerType = "ALUNO"
)

// Sexo representa o sexo biológico do aluno.
type Sexo string

const (
	SexoMasculino Sexo = "M"
	SexoFeminino  Sexo = "F"
	SexoOutro     Sexo = "OUTRO"
)

// PersonalTrainer é o profissional que gerencia alunos e treinos.
type PersonalTrainer struct {
	ID           uuid.UUID
	Nome         string
	Email        string
	Telefone     string
	CREF         string
	Ativo        bool
	CriadoEm     time.Time
	AtualizadoEm time.Time
}

// FullName retorna o nome do personal já normalizado (trim).
func (p *PersonalTrainer) FullName() string {
	return strings.TrimSpace(p.Nome)
}

// Aluno é o cliente vinculado a um personal trainer.
type Aluno struct {
	ID             uuid.UUID
	PersonalID     uuid.UUID
	Nome           string
	Email          string
	DataNascimento *time.Time
	Sexo           *Sexo
	Telefone       string
	Ativo          bool
	CriadoEm       time.Time
	AtualizadoEm   time.Time
}

// FullName retorna o nome do aluno já normalizado (trim).
func (a *Aluno) FullName() string {
	return strings.TrimSpace(a.Nome)
}

// Credencial armazena o hash de senha de um usuário (personal ou aluno).
type Credencial struct {
	ID           uuid.UUID
	OwnerID      uuid.UUID
	OwnerType    OwnerType
	PasswordHash string
	UltimoAcesso *time.Time
}

// RefreshToken representa um refresh token armazenado no banco para rotação e revogação.
type RefreshToken struct {
	ID       uuid.UUID
	OwnerID  uuid.UUID
	JTI      string
	ExpiraEm time.Time
	Revogado bool
	CriadoEm time.Time
}

// IsExpired retorna true se o refresh token já expirou.
func (rt *RefreshToken) IsExpired(now time.Time) bool {
	return now.After(rt.ExpiraEm)
}
