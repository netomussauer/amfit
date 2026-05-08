package domain

import "errors"

// Erros sentinel do contexto Training. Use errors.Is para comparar.
//
// Nota anti-enumeration: as variantes "NotFound" e "Forbidden" são distintas
// internamente para fins de log/auditoria, mas o handler HTTP traduz ambas
// para 403/404 conforme a regra de cada rota — em particular, leituras
// retornam 404 e mutações sobre recursos de outros personals retornam 403
// genérico, sem indicar a existência do recurso.
var (
	// ErrFichaNotFound indica que a ficha não existe.
	ErrFichaNotFound = errors.New("training: ficha não encontrada")

	// ErrFichaForbidden indica que a ficha existe mas pertence a outro personal.
	ErrFichaForbidden = errors.New("training: operação não permitida sobre esta ficha")

	// ErrTreinoNotFound indica que o treino não existe.
	ErrTreinoNotFound = errors.New("training: treino não encontrado")

	// ErrTreinoForbidden indica que o treino pertence a uma ficha de outro personal.
	ErrTreinoForbidden = errors.New("training: operação não permitida sobre este treino")

	// ErrItemTreinoNotFound indica que o item de treino não existe.
	ErrItemTreinoNotFound = errors.New("training: item de treino não encontrado")

	// ErrItemTreinoForbidden indica que o item pertence a um treino de outro personal.
	ErrItemTreinoForbidden = errors.New("training: operação não permitida sobre este item")

	// ErrLetraJaUsada indica violação da UNIQUE (ficha_id, letra) — duas
	// chamadas tentaram criar o mesmo treino dentro da ficha.
	ErrLetraJaUsada = errors.New("training: letra de treino já usada nesta ficha")

	// ErrSemFichaAtiva indica que o aluno não tem nenhuma ficha ativa hoje.
	ErrSemFichaAtiva = errors.New("training: aluno sem ficha ativa")

	// ErrSemTreinoHoje indica que existe ficha ativa mas sem treinos
	// configurados — caller traduz para HTTP 204.
	ErrSemTreinoHoje = errors.New("training: ficha sem treinos configurados")

	// ErrReorderInconsistente indica que a lista de IDs do reorder não bate
	// com os itens efetivamente persistidos no treino — evita atualizações
	// parciais que deixariam o estado inconsistente.
	ErrReorderInconsistente = errors.New("training: lista de itens para reordenação inconsistente")
)
