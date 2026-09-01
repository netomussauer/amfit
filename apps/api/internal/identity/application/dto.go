package application

import "time"

// RegisterPersonalRequest é o payload de registro de um novo personal trainer.
type RegisterPersonalRequest struct {
	Nome     string `json:"nome" validate:"required,min=2,max=150"`
	Email    string `json:"email" validate:"required,email"`
	Senha    string `json:"senha" validate:"required,min=8"`
	Telefone string `json:"telefone,omitempty" validate:"omitempty,max=20"`
	CREF     string `json:"cref,omitempty" validate:"omitempty,max=20"`
}

// LoginRequest é o payload de autenticação por email/senha.
type LoginRequest struct {
	Email string `json:"email" validate:"required,email"`
	Senha string `json:"senha" validate:"required,min=8"`
	Tipo  string `json:"tipo" validate:"required,oneof=PERSONAL ALUNO"`
}

// RefreshRequest é o payload da rota POST /auth/refresh.
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// LogoutRequest é o payload da rota POST /auth/logout.
type LogoutRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// AuthResponse encapsula tokens emitidos para o cliente após login/refresh.
type AuthResponse struct {
	AccessToken  string       `json:"access_token"`
	TokenType    string       `json:"token_type"`
	ExpiresIn    int          `json:"expires_in"`
	RefreshToken string       `json:"refresh_token"`
	Usuario      UsuarioBasic `json:"usuario"`
}

// UsuarioBasic representa os dados mínimos do usuário no AuthResponse.
type UsuarioBasic struct {
	ID   string `json:"id"`
	Nome string `json:"nome"`
	Role string `json:"role"`
}

// CriarAlunoRequest é o payload de criação de um aluno por um personal.
type CriarAlunoRequest struct {
	Nome           string `json:"nome" validate:"required,min=2,max=150"`
	Email          string `json:"email" validate:"required,email"`
	Senha          string `json:"senha" validate:"required,min=8"`
	Telefone       string `json:"telefone,omitempty" validate:"omitempty,max=20"`
	DataNascimento string `json:"data_nascimento,omitempty" validate:"omitempty,datetime=2006-01-02"`
	Sexo           string `json:"sexo,omitempty" validate:"omitempty,oneof=M F OUTRO"`
}

// AtualizarAlunoRequest é o payload PATCH /alunos/{id}.
type AtualizarAlunoRequest struct {
	Nome           *string `json:"nome,omitempty" validate:"omitempty,min=2,max=150"`
	Email          *string `json:"email,omitempty" validate:"omitempty,email"`
	Telefone       *string `json:"telefone,omitempty" validate:"omitempty,max=20"`
	DataNascimento *string `json:"data_nascimento,omitempty" validate:"omitempty,datetime=2006-01-02"`
	Sexo           *string `json:"sexo,omitempty" validate:"omitempty,oneof=M F OUTRO"`
}

// AlunoResponse é o DTO de saída para um aluno.
type AlunoResponse struct {
	ID             string    `json:"id"`
	Nome           string    `json:"nome"`
	Email          string    `json:"email"`
	Telefone       string    `json:"telefone,omitempty"`
	DataNascimento string    `json:"data_nascimento,omitempty"`
	Sexo           string    `json:"sexo,omitempty"`
	Ativo          bool      `json:"ativo"`
	CriadoEm       time.Time `json:"criado_em"`
}

// AlunoListResponse encapsula uma página de alunos.
type AlunoListResponse struct {
	Data       []AlunoResponse `json:"data"`
	Pagination Pagination      `json:"pagination"`
}

// Pagination descreve metadados de paginação.
type Pagination struct {
	Total   int `json:"total"`
	Page    int `json:"page"`
	PerPage int `json:"per_page"`
}

// AtualizarPersonalRequest é o payload PATCH /personal/me.
type AtualizarPersonalRequest struct {
	Nome     *string `json:"nome,omitempty" validate:"omitempty,min=2,max=150"`
	Email    *string `json:"email,omitempty" validate:"omitempty,email"`
	Telefone *string `json:"telefone,omitempty" validate:"omitempty,max=20"`
	CREF     *string `json:"cref,omitempty" validate:"omitempty,max=20"`
}

// AlterarSenhaRequest é o payload PATCH /personal/me/senha.
type AlterarSenhaRequest struct {
	SenhaAtual string `json:"senha_atual" validate:"required,min=8"`
	NovaSenha  string `json:"nova_senha" validate:"required,min=8"`
}

// PersonalResponse é o DTO de saída para o personal trainer autenticado.
type PersonalResponse struct {
	ID       string    `json:"id"`
	Nome     string    `json:"nome"`
	Email    string    `json:"email"`
	Telefone string    `json:"telefone,omitempty"`
	CREF     string    `json:"cref,omitempty"`
	Ativo    bool      `json:"ativo"`
	CriadoEm time.Time `json:"criado_em"`
}
