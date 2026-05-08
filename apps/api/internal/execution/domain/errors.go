package domain

import "errors"

// Erros sentinel do contexto Execution. Use errors.Is para comparar.
//
// Nota anti-enumeration: ErrSessaoForbidden é internamente distinto de
// ErrSessaoNotFound para fins de log/auditoria, mas o handler HTTP traduz
// ambos para 404 — não vazamos a existência de uma sessão de outro aluno.
var (
	// ErrSessaoNotFound indica que a sessão não existe.
	ErrSessaoNotFound = errors.New("execution: sessão não encontrada")

	// ErrSessaoForbidden indica que a sessão pertence a outro aluno (ou a um
	// aluno fora do escopo do personal autenticado).
	ErrSessaoForbidden = errors.New("execution: operação não permitida sobre esta sessão")

	// ErrSessaoJaConcluida indica tentativa de modificar séries de uma sessão
	// que já está em status CONCLUIDO ou ABANDONADO.
	ErrSessaoJaConcluida = errors.New("execution: sessão já concluída")

	// ErrTreinoInvalido indica que o treino_id informado não existe ou não
	// pertence à ficha ativa do aluno autenticado.
	ErrTreinoInvalido = errors.New("execution: treino inválido para o aluno")

	// ErrSerieInvalida indica que numero_serie excede o total de séries
	// configuradas para o item de treino, ou que o item não existe.
	ErrSerieInvalida = errors.New("execution: série inválida para o item de treino")
)
