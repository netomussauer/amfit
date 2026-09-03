// Package domain define as entidades e tipos do contexto Training.
package domain

import (
	"time"

	"github.com/google/uuid"
)

// FichaTreino é a coleção de treinos atribuída a um aluno por um personal.
type FichaTreino struct {
	ID             uuid.UUID
	AlunoID        uuid.UUID
	PersonalID     uuid.UUID
	Nome           string
	VigenciaInicio time.Time
	VigenciaFim    *time.Time
	Ativa          bool
	CriadoEm       time.Time
	AtualizadoEm   time.Time
}

// Treino é um conjunto de exercícios identificado por letra (A, B, C...).
// Nome é opcional — quando vazio, o cliente exibe apenas a letra.
type Treino struct {
	ID      uuid.UUID
	FichaID uuid.UUID
	Letra   string
	Nome    string
	Ordem   int
}

// ItemTreino é uma entrada na ficha — um exercício com parâmetros prescritos
// (séries, repetições, carga sugerida, descanso e observação opcional).
type ItemTreino struct {
	ID               uuid.UUID
	TreinoID         uuid.UUID
	ExercicioID      uuid.UUID
	Ordem            int
	Series           int
	Repeticoes       string
	CargaSugerida    *float64
	DescansoSegundos *int
	Observacao       string
}

// FichaCompleta é o read-model usado para retornar uma ficha com todos os
// treinos e itens já agregados — evita roundtrips do cliente.
type FichaCompleta struct {
	Ficha   FichaTreino
	Treinos []TreinoCompleto
}

// TreinoCompleto agrega um treino com seus itens (já com dados do exercício).
type TreinoCompleto struct {
	Treino Treino
	Itens  []ItemTreinoComExercicio
}

// ItemTreinoComExercicio agrega ao ItemTreino os campos do exercício
// referenciado e de seu grupo muscular — para exibição direta na UI sem
// outro round-trip.
type ItemTreinoComExercicio struct {
	ItemTreino
	ExercicioNome      string
	ExercicioDescricao string
	ExercicioMidiaURL  string
	ExercicioTipoMidia string
	ExercicioIsGlobal  bool
	GrupoMuscularID    uuid.UUID
	GrupoMuscularNome  string
}

// OrigemTemplate identifica quem criou o template: SISTEMA (global, mesmo
// conteúdo pra todos os personals) ou PERSONAL (custom, só o dono vê).
type OrigemTemplate string

const (
	OrigemTemplateSistema  OrigemTemplate = "SISTEMA"
	OrigemTemplatePersonal OrigemTemplate = "PERSONAL"
)

// TemplateTreino é uma ficha modelo sugerida a partir do nível/objetivo
// apurados na anamnese (SDD §20.2) — o personal pode aplicá-la via
// POST /fichas/from-template em vez de montar a ficha do zero.
type TemplateTreino struct {
	ID         uuid.UUID
	Nome       string
	Nivel      string // INICIANTE|INTERMEDIARIO|AVANCADO — mesmo vocabulário da anamnese
	Objetivo   string // hipertrofia|emagrecimento|forca|condicionamento
	CriadoPor  OrigemTemplate
	PersonalID *uuid.UUID // nil quando CriadoPor=SISTEMA
	Ativo      bool
	CriadoEm   time.Time
}

// TemplateItem é uma entrada de exercício dentro de um TemplateTreino —
// mesmo shape prescritivo de ItemTreino, mas com a letra do treino embutida
// (o template não tem uma entidade Treino própria; ela só nasce quando o
// template é aplicado a uma ficha real).
type TemplateItem struct {
	ID               uuid.UUID
	TemplateID       uuid.UUID
	ExercicioID      uuid.UUID
	TreinoLetra      string
	Ordem            int
	Series           int
	Repeticoes       string
	CargaSugerida    *float64
	DescansoSegundos *int
}
