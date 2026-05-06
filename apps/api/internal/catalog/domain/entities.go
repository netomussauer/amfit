// Package domain define as entidades e tipos do contexto Catalog.
package domain

import (
	"time"

	"github.com/google/uuid"
)

// TipoMidia classifica o tipo de arquivo de mídia associado a um exercício.
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
type Exercicio struct {
	ID              uuid.UUID
	PersonalID      *uuid.UUID
	Nome            string
	Descricao       string
	GrupoMuscularID uuid.UUID
	MidiaURL        *string
	TipoMidia       *TipoMidia
	Ativo           bool
	CriadoEm       time.Time
}
