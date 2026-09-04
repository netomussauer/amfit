package application

import (
	"fmt"

	"github.com/amfit/api/internal/financial/domain"
	"github.com/google/uuid"
)

func toPlanoResponse(p *domain.PlanoAluno) PlanoResponse {
	resp := PlanoResponse{
		ID:             p.ID.String(),
		AlunoID:        p.AlunoID.String(),
		ValorMensal:    p.ValorMensal,
		DiaVencimento:  p.DiaVencimento,
		VigenciaInicio: p.VigenciaInicio.Format(dateLayout),
		Status:         string(p.Status),
		Observacao:     p.Observacao,
		CriadoEm:       p.CriadoEm,
		AtualizadoEm:   p.AtualizadoEm,
	}
	if p.VigenciaFim != nil {
		fim := p.VigenciaFim.Format(dateLayout)
		resp.VigenciaFim = &fim
	}
	return resp
}

func toMensalidadeResponse(m *domain.Mensalidade) MensalidadeResponse {
	resp := MensalidadeResponse{
		ID:             m.ID.String(),
		PlanoID:        m.PlanoID.String(),
		AlunoID:        m.AlunoID.String(),
		CompetenciaAno: m.CompetenciaAno,
		CompetenciaMes: m.CompetenciaMes,
		DataVencimento: m.DataVencimento.Format(dateLayout),
		Valor:          m.Valor,
		Status:         string(m.Status),
		ValorPago:      m.ValorPago,
		Observacao:     m.Observacao,
		CriadoEm:       m.CriadoEm,
		AtualizadoEm:   m.AtualizadoEm,
	}
	if m.DataPagamento != nil {
		data := m.DataPagamento.Format(dateLayout)
		resp.DataPagamento = &data
	}
	if m.FormaPagamento != nil {
		forma := string(*m.FormaPagamento)
		resp.FormaPagamento = &forma
	}
	return resp
}

func toMensalidadeListResponse(
	mensalidades []*domain.Mensalidade,
	total int,
	params domain.ListarMensalidadesParams,
) *MensalidadeListResponse {
	data := make([]MensalidadeResponse, 0, len(mensalidades))
	for _, m := range mensalidades {
		data = append(data, toMensalidadeResponse(m))
	}
	return &MensalidadeListResponse{
		Data: data,
		Pagination: Pagination{
			Total:   total,
			Page:    params.Page,
			PerPage: params.PerPage,
		},
	}
}

func toDashboardResponse(d *domain.DashboardFinanceiro) *DashboardFinanceiroResponse {
	inadimplentes := make([]AlunoInadimplenteResponse, 0, len(d.Inadimplentes))
	for _, a := range d.Inadimplentes {
		inadimplentes = append(inadimplentes, AlunoInadimplenteResponse{
			AlunoID:            a.AlunoID.String(),
			Nome:               a.Nome,
			QtdAtrasadas:       a.QtdAtrasadas,
			ValorTotalAtrasado: a.ValorTotalAtrasado,
		})
	}
	return &DashboardFinanceiroResponse{
		MensalidadesPendentes: ResumoContagemValor{Qtd: d.PendentesQtd, Valor: d.PendentesValor},
		MensalidadesAtrasadas: ResumoContagemValor{Qtd: d.AtrasadasQtd, Valor: d.AtrasadasValor},
		ReceitaMesAtual:       d.ReceitaMesAtual,
		Inadimplentes:         inadimplentes,
	}
}

// toRepoParams converte os filtros de query string (strings) para os tipos
// tipados que o repository espera, aplicando os defaults de paginação.
func toRepoParams(req ListarMensalidadesRequest) (domain.ListarMensalidadesParams, error) {
	var p domain.ListarMensalidadesParams

	if req.AlunoID != nil {
		id, err := uuid.Parse(*req.AlunoID)
		if err != nil {
			return p, fmt.Errorf("application: aluno_id invalido: %w", err)
		}
		p.AlunoID = &id
	}
	if req.Status != nil {
		status := domain.StatusMensalidade(*req.Status)
		p.Status = &status
	}
	p.CompetenciaAno = req.CompetenciaAno
	p.CompetenciaMes = req.CompetenciaMes

	p.Page = req.Page
	if p.Page <= 0 {
		p.Page = 1
	}
	p.PerPage = req.PerPage
	if p.PerPage <= 0 {
		p.PerPage = defaultPerPage
	}
	if p.PerPage > maxPerPage {
		p.PerPage = maxPerPage
	}
	return p, nil
}
