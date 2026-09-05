package domain

import "errors"

// Erros sentinel do contexto Coach. Use errors.Is para comparar.
var (
	// ErrCoachVideoNaoEncontrado indica que o vídeo não existe ou não
	// pertence ao personal/aluno autenticado.
	ErrCoachVideoNaoEncontrado = errors.New("coach: vídeo não encontrado")

	// ErrCoachVideoJaTemFeedback indica que o vídeo já recebeu feedback —
	// evita que o personal envie uma segunda resposta pro mesmo vídeo.
	ErrCoachVideoJaTemFeedback = errors.New("coach: vídeo já tem feedback")

	// ErrDuracaoInvalida indica que a duração informada excede o limite
	// (60s) ou não é positiva.
	ErrDuracaoInvalida = errors.New("coach: duração do vídeo inválida (máximo 60s)")

	// ErrTipoVideoInvalido indica que o content-type do vídeo enviado não
	// é suportado (só mp4/quicktime).
	ErrTipoVideoInvalido = errors.New("coach: tipo de vídeo inválido")

	// ErrVideoTamanhoExcedido indica que o vídeo enviado excede o limite
	// de tamanho permitido.
	ErrVideoTamanhoExcedido = errors.New("coach: tamanho do vídeo excede o limite")

	// ErrItemTreinoInvalido indica que item_treino_id não existe — mapeado
	// pelo repository a partir de uma violação de foreign key.
	ErrItemTreinoInvalido = errors.New("coach: item_treino_id inválido")
)
