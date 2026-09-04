package application

import "time"

// CriarPlanoRequest é o payload de POST /alunos/{id}/plano.
type CriarPlanoRequest struct {
	ValorMensal    float64 `json:"valor_mensal" validate:"required,gt=0"`
	DiaVencimento  int     `json:"dia_vencimento" validate:"required,min=1,max=28"`
	VigenciaInicio string  `json:"vigencia_inicio,omitempty" validate:"omitempty,datetime=2006-01-02"`
	Observacao     string  `json:"observacao,omitempty" validate:"omitempty,max=500"`
}

// AtualizarPlanoRequest é o payload de PATCH /planos/{id}. VigenciaFim
// aceita "" para limpar o campo (plano volta a ser indeterminado) — mesmo
// padrão de "clear para string vazia" usado em outros PATCHes do codebase
// (ver AtualizarTenantConfigRequest.NomeApp).
type AtualizarPlanoRequest struct {
	ValorMensal   *float64 `json:"valor_mensal,omitempty" validate:"omitempty,gt=0"`
	DiaVencimento *int     `json:"dia_vencimento,omitempty" validate:"omitempty,min=1,max=28"`
	VigenciaFim   *string  `json:"vigencia_fim,omitempty" validate:"omitempty,datetime=2006-01-02"`
	Status        *string  `json:"status,omitempty" validate:"omitempty,oneof=ATIVO SUSPENSO ENCERRADO"`
	Observacao    *string  `json:"observacao,omitempty" validate:"omitempty,max=500"`
}

// PlanoResponse é o DTO de saída para um PlanoAluno.
type PlanoResponse struct {
	ID             string    `json:"id"`
	AlunoID        string    `json:"aluno_id"`
	ValorMensal    float64   `json:"valor_mensal"`
	DiaVencimento  int       `json:"dia_vencimento"`
	VigenciaInicio string    `json:"vigencia_inicio"`
	VigenciaFim    *string   `json:"vigencia_fim,omitempty"`
	Status         string    `json:"status"`
	Observacao     string    `json:"observacao,omitempty"`
	CriadoEm       time.Time `json:"criado_em"`
	AtualizadoEm   time.Time `json:"atualizado_em"`
}

// MarcarPagaRequest é o payload de PATCH /mensalidades/{id}/marcar-paga.
// ValorPago/DataPagamento são opcionais — quando omitidos, o service usa o
// valor cheio da mensalidade e a data de hoje.
type MarcarPagaRequest struct {
	ValorPago      *float64 `json:"valor_pago,omitempty" validate:"omitempty,gt=0"`
	DataPagamento  *string  `json:"data_pagamento,omitempty" validate:"omitempty,datetime=2006-01-02"`
	FormaPagamento string   `json:"forma_pagamento" validate:"required,oneof=PIX BOLETO CARTAO DINHEIRO"`
	Observacao     string   `json:"observacao,omitempty" validate:"omitempty,max=500"`
}

// AtualizarStatusMensalidadeRequest é o payload de PATCH /mensalidades/{id}
// — só permite CANCELAR ou ISENTAR (marcar como paga tem endpoint próprio,
// que preenche valor/data/forma de pagamento).
type AtualizarStatusMensalidadeRequest struct {
	Status     string `json:"status" validate:"required,oneof=CANCELADA ISENTA"`
	Observacao string `json:"observacao,omitempty" validate:"omitempty,max=500"`
}

// MensalidadeResponse é o DTO de saída para uma Mensalidade.
type MensalidadeResponse struct {
	ID             string    `json:"id"`
	PlanoID        string    `json:"plano_id"`
	AlunoID        string    `json:"aluno_id"`
	CompetenciaAno int       `json:"competencia_ano"`
	CompetenciaMes int       `json:"competencia_mes"`
	DataVencimento string    `json:"data_vencimento"`
	Valor          float64   `json:"valor"`
	Status         string    `json:"status"`
	ValorPago      *float64  `json:"valor_pago,omitempty"`
	DataPagamento  *string   `json:"data_pagamento,omitempty"`
	FormaPagamento *string   `json:"forma_pagamento,omitempty"`
	Observacao     string    `json:"observacao,omitempty"`
	CriadoEm       time.Time `json:"criado_em"`
	AtualizadoEm   time.Time `json:"atualizado_em"`
}

// Pagination descreve metadados de paginação — mesma forma usada em outros
// contextos (ex: identity.AlunoListResponse), redefinida aqui porque cada
// bounded context é um pacote Go isolado.
type Pagination struct {
	Total   int `json:"total"`
	Page    int `json:"page"`
	PerPage int `json:"per_page"`
}

// MensalidadeListResponse encapsula uma página de mensalidades.
type MensalidadeListResponse struct {
	Data       []MensalidadeResponse `json:"data"`
	Pagination Pagination            `json:"pagination"`
}

// ListarMensalidadesRequest é o conjunto de filtros de query string de
// GET /mensalidades e GET /alunos/me/mensalidades.
type ListarMensalidadesRequest struct {
	AlunoID        *string
	Status         *string
	CompetenciaAno *int
	CompetenciaMes *int
	Page           int
	PerPage        int
}

// ResumoContagemValor agrega uma contagem e um valor total — usado nos
// blocos de pendentes/atrasadas do dashboard.
type ResumoContagemValor struct {
	Qtd   int     `json:"qtd"`
	Valor float64 `json:"valor"`
}

// AlunoInadimplenteResponse resume a situação de atraso de um aluno.
type AlunoInadimplenteResponse struct {
	AlunoID            string  `json:"aluno_id"`
	Nome               string  `json:"nome"`
	QtdAtrasadas       int     `json:"qtd_atrasadas"`
	ValorTotalAtrasado float64 `json:"valor_total_atrasado"`
}

// DashboardFinanceiroResponse é o DTO de saída de GET /financeiro/dashboard.
type DashboardFinanceiroResponse struct {
	MensalidadesPendentes ResumoContagemValor         `json:"mensalidades_pendentes"`
	MensalidadesAtrasadas ResumoContagemValor         `json:"mensalidades_atrasadas"`
	ReceitaMesAtual       float64                     `json:"receita_mes_atual"`
	Inadimplentes         []AlunoInadimplenteResponse `json:"inadimplentes"`
}
