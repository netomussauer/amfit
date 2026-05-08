// Package domain define as entidades e tipos do contexto Catalog.
package domain

import (
	"time"

	"github.com/google/uuid"
)

// TipoMidia classifica o tipo de arquivo de mídia associado a um exercício.
// Espelha o ENUM tipo_midia em PostgreSQL.
type TipoMidia string

const (
	TipoMidiaVideo  TipoMidia = "VIDEO"
	TipoMidiaGIF    TipoMidia = "GIF"
	TipoMidiaImagem TipoMidia = "IMAGEM"
)

// GrupoMuscular representa uma classificação anatômica de exercício.
type GrupoMuscular struct {
	ID        uuid.UUID
	Nome      string
	Descricao string
}

// Exercicio é um movimento físico com nome, grupo muscular e mídia demonstrativa.
// PersonalID nil indica exercício global (disponível a todos os personals).
// MidiaURL e TipoMidia vazios indicam exercício sem mídia anexada.
type Exercicio struct {
	ID              uuid.UUID
	PersonalID      *uuid.UUID
	Nome            string
	Descricao       string
	GrupoMuscularID uuid.UUID
	MidiaURL        string
	TipoMidia       string
	Ativo           bool
	CriadoEm        time.Time
}

// IsGlobal indica se o exercício é global (sem dono) — é a mesma regra usada
// pelas queries (personal_id IS NULL).
func (e *Exercicio) IsGlobal() bool {
	return e.PersonalID == nil
}

// ExercicioComGrupo agrega o nome do grupo muscular ao Exercicio para evitar
// um round-trip extra ao DB ao montar a resposta HTTP.
type ExercicioComGrupo struct {
	Exercicio
	GrupoMuscularNome string
}
