// Package domain define as entidades e tipos do contexto Financial.
package domain

import (
	"time"

	"github.com/google/uuid"
)

// StatusPlano é o ciclo de vida de um PlanoAluno.
type StatusPlano string

const (
	StatusPlanoAtivo     StatusPlano = "ATIVO"
	StatusPlanoSuspenso  StatusPlano = "SUSPENSO"
	StatusPlanoEncerrado StatusPlano = "ENCERRADO"
)

// StatusMensalidade é o ciclo de vida de uma Mensalidade.
type StatusMensalidade string

const (
	StatusMensalidadePendente  StatusMensalidade = "PENDENTE"
	StatusMensalidadePaga      StatusMensalidade = "PAGA"
	StatusMensalidadeAtrasada  StatusMensalidade = "ATRASADA"
	StatusMensalidadeCancelada StatusMensalidade = "CANCELADA"
	StatusMensalidadeIsenta    StatusMensalidade = "ISENTA"
)

// FormaPagamento identifica como uma mensalidade foi paga — só preenchida
// quando Status = PAGA.
type FormaPagamento string

const (
	FormaPagamentoPix      FormaPagamento = "PIX"
	FormaPagamentoBoleto   FormaPagamento = "BOLETO"
	FormaPagamentoCartao   FormaPagamento = "CARTAO"
	FormaPagamentoDinheiro FormaPagamento = "DINHEIRO"
)

// PlanoAluno é a configuração do contrato vigente entre personal e aluno —
// valor mensal, dia de vencimento e vigência (SDD §13.1).
type PlanoAluno struct {
	ID             uuid.UUID
	AlunoID        uuid.UUID
	PersonalID     uuid.UUID
	ValorMensal    float64
	DiaVencimento  int
	VigenciaInicio time.Time
	VigenciaFim    *time.Time
	Status         StatusPlano
	Observacao     string
	CriadoEm       time.Time
	AtualizadoEm   time.Time
}

// Mensalidade é uma cobrança individual de um mês de competência —
// entidade central do contexto (SDD §13.1).
type Mensalidade struct {
	ID              uuid.UUID
	PlanoID         uuid.UUID
	AlunoID         uuid.UUID
	CompetenciaAno  int
	CompetenciaMes  int
	DataVencimento  time.Time
	Valor           float64
	Status          StatusMensalidade
	ValorPago       *float64
	DataPagamento   *time.Time
	FormaPagamento  *FormaPagamento
	Observacao      string
	LembreteEnviado bool
	CriadoEm        time.Time
	AtualizadoEm    time.Time
}
