package domain

import "errors"

// Erros sentinel do contexto Financial. Use errors.Is para comparar.
var (
	// ErrPlanoNaoEncontrado indica que o plano não existe ou não pertence
	// ao personal autenticado.
	ErrPlanoNaoEncontrado = errors.New("financial: plano não encontrado")

	// ErrPlanoJaAtivo indica que o aluno já tem um plano ATIVO — o personal
	// precisa atualizar o existente (PATCH) em vez de criar outro.
	ErrPlanoJaAtivo = errors.New("financial: aluno já tem um plano ativo")

	// ErrMensalidadeNaoEncontrada indica que a mensalidade não existe ou não
	// pertence a um aluno do personal autenticado.
	ErrMensalidadeNaoEncontrada = errors.New("financial: mensalidade não encontrada")

	// ErrMensalidadeJaPaga indica que a mensalidade já está marcada como
	// paga — evita sobrescrever data/forma de pagamento por engano.
	ErrMensalidadeJaPaga = errors.New("financial: mensalidade já está paga")

	// ErrStatusMensalidadeInvalido indica uma transição de status não
	// permitida (ex: marcar como paga uma mensalidade cancelada).
	ErrStatusMensalidadeInvalido = errors.New("financial: transição de status inválida para a mensalidade")
)
