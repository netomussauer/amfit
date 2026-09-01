package domain

import "errors"

// Erros sentinel do contexto Identity. Use errors.Is para comparar.
var (
	// ErrEmailAlreadyExists indica violação de unicidade no campo email.
	ErrEmailAlreadyExists = errors.New("identity: email já cadastrado")

	// ErrInvalidCredentials é usado tanto para email não encontrado quanto
	// para senha incorreta, evitando user enumeration.
	ErrInvalidCredentials = errors.New("identity: credenciais inválidas")

	// ErrPersonalNotFound indica que o personal trainer não existe.
	ErrPersonalNotFound = errors.New("identity: personal trainer não encontrado")

	// ErrAlunoNotFound indica que o aluno não existe ou não pertence ao personal.
	ErrAlunoNotFound = errors.New("identity: aluno não encontrado")

	// ErrInvalidRefreshToken indica que o refresh token é malformado ou expirou.
	ErrInvalidRefreshToken = errors.New("identity: refresh token inválido")

	// ErrRefreshTokenRevoked indica que o refresh token foi revogado previamente.
	ErrRefreshTokenRevoked = errors.New("identity: refresh token revogado")

	// ErrSenhaAtualIncorreta indica que a senha atual informada em uma troca
	// de senha não confere com o hash armazenado.
	ErrSenhaAtualIncorreta = errors.New("identity: senha atual incorreta")
)
