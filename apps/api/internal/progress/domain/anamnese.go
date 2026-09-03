package domain

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

// NivelAnamnese e o nivel de experiencia apurado a partir do score da
// anamnese. Valores casam com o enum Postgres `nivel_anamnese`.
type NivelAnamnese string

const (
	NivelIniciante     NivelAnamnese = "INICIANTE"
	NivelIntermediario NivelAnamnese = "INTERMEDIARIO"
	NivelAvancado      NivelAnamnese = "AVANCADO"
)

// RespostaAnamnese e uma resposta unica dentro do bloco de scoring —
// guarda tanto a opcao escolhida (para exibicao) quanto os pontos que ela
// valeu (para auditoria), ja resolvidos pela tabela de scoring do backend.
type RespostaAnamnese struct {
	Opcao  string
	Pontos int
}

// RespostasAnamnese agrupa as 5 perguntas padronizadas do formulario de
// scoring (SDD §20.2). Cada campo e preenchido a partir da opcao escolhida
// pelo personal — o backend resolve os pontos, nunca confia em pontos
// vindos do cliente.
type RespostasAnamnese struct {
	FrequenciaSemanal RespostaAnamnese
	ExperienciaMeses  RespostaAnamnese
	Objetivo          RespostaAnamnese
	Restricoes        RespostaAnamnese
	Disponibilidade   RespostaAnamnese
}

// Anamnese e o registro de avaliacao inicial de um aluno, com o score e o
// nivel sugerido calculados pelo backend a partir de RespostasAnamnese.
type Anamnese struct {
	ID                        uuid.UUID
	AlunoID                   uuid.UUID
	Objetivo                  string
	Lesoes                    *string
	DoencasPreexistentes      *string
	Medicamentos              *string
	PraticaOutroEsporte       bool
	OutroEsporte              *string
	FrequenciaSemanasAnterior *int
	ObservacoesGerais         *string
	Respostas                 RespostasAnamnese
	ScoreCalculado            int
	NivelSugerido             NivelAnamnese
	PreenchidoEm              time.Time
	AtualizadoEm              time.Time
}

// ErrAnamneseNotFound indica que o aluno ainda nao tem anamnese registrada.
var ErrAnamneseNotFound = errors.New("progress: anamnese nao encontrada")

// ErrOpcaoAnamneseInvalida indica que uma das 5 respostas de scoring trouxe
// uma chave de opcao fora da tabela conhecida (ver anamnese_scoring.go).
var ErrOpcaoAnamneseInvalida = errors.New("progress: opcao de anamnese invalida")
