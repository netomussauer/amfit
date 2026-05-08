package domain

import (
	"context"

	"github.com/google/uuid"
)

// ListFichasFilter parametriza a busca de fichas.
//
// PersonalID é sempre obrigatório (escopo de tenant). AlunoID é opcional —
// quando definido, restringe ao aluno informado. Ativa é tri-estado:
// nil = todas; true = somente ativas; false = somente inativas.
type ListFichasFilter struct {
	PersonalID uuid.UUID
	AlunoID    *uuid.UUID
	Ativa      *bool
}

// FichaRepository define o contrato de persistência para FichaTreino.
type FichaRepository interface {
	Create(ctx context.Context, f *FichaTreino) error
	FindByID(ctx context.Context, id uuid.UUID) (*FichaTreino, error)
	List(ctx context.Context, filter ListFichasFilter) ([]*FichaTreino, error)
	FindAtivaByAluno(ctx context.Context, alunoID uuid.UUID) (*FichaTreino, error)
	Update(ctx context.Context, f *FichaTreino) error
	Deactivate(ctx context.Context, id uuid.UUID) error
}

// TreinoRepository define o contrato de persistência para Treino.
type TreinoRepository interface {
	Create(ctx context.Context, t *Treino) error
	FindByID(ctx context.Context, id uuid.UUID) (*Treino, error)
	ListByFicha(ctx context.Context, fichaID uuid.UUID) ([]*Treino, error)
	Update(ctx context.Context, t *Treino) error
	Delete(ctx context.Context, id uuid.UUID) error
}

// ItemTreinoRepository define o contrato de persistência para ItemTreino.
type ItemTreinoRepository interface {
	Create(ctx context.Context, i *ItemTreino) error
	FindByID(ctx context.Context, id uuid.UUID) (*ItemTreino, error)
	ListByTreino(ctx context.Context, treinoID uuid.UUID) ([]*ItemTreino, error)
	Update(ctx context.Context, i *ItemTreino) error
	Delete(ctx context.Context, id uuid.UUID) error
	// Reorder atualiza a coluna ordem dos itens informados em uma única
	// transação. A nova ordem corresponde à posição do ID em novosIDs
	// (índice 0 = ordem 0). Falha atomicamente se algum ID não pertencer
	// ao treino.
	Reorder(ctx context.Context, treinoID uuid.UUID, novosIDs []uuid.UUID) error
}

// FichaCompletaRepository agrega a leitura ficha + treinos + itens em um
// read-model único. Concentra os JOINs com exercicio e grupo_muscular.
type FichaCompletaRepository interface {
	GetCompleta(ctx context.Context, fichaID uuid.UUID) (*FichaCompleta, error)
}

// TreinoHojeRepository implementa a lógica do "próximo treino da sequência"
// — encapsulada num repositório próprio porque a query cruza Training com
// Execution (sessao_treino) e merece testes/otimização independentes.
type TreinoHojeRepository interface {
	GetTreinoHoje(ctx context.Context, alunoID uuid.UUID) (*TreinoCompleto, error)
}
