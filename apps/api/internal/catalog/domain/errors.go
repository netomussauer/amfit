package domain

import "errors"

// Erros sentinel do contexto Catalog. Use errors.Is para comparar.
var (
	// ErrExercicioNotFound indica que o exercício não existe ou não é
	// visível ao chamador.
	ErrExercicioNotFound = errors.New("catalog: exercício não encontrado")

	// ErrGrupoMuscularNotFound indica que o grupo muscular não existe.
	ErrGrupoMuscularNotFound = errors.New("catalog: grupo muscular não encontrado")

	// ErrExercicioForbidden indica tentativa de modificar exercício que
	// não pertence ao personal autenticado (inclui exercícios globais).
	ErrExercicioForbidden = errors.New("catalog: operação não permitida sobre este exercício")

	// ErrTipoMidiaInvalido indica que o content-type ou a extensão da mídia
	// não está entre os tipos suportados.
	ErrTipoMidiaInvalido = errors.New("catalog: tipo de mídia inválido")

	// ErrMidiaTamanhoExcedido indica que a mídia excedeu o limite permitido.
	ErrMidiaTamanhoExcedido = errors.New("catalog: tamanho da mídia excede o limite")
)
