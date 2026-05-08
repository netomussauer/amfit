package application

import "time"

// ── Requests ──────────────────────────────────────────────────────────────

// IniciarSessaoRequest é o payload de POST /sessoes (role=ALUNO).
type IniciarSessaoRequest struct {
	TreinoID string `json:"treino_id" validate:"required,uuid"`
}

// RegistrarSerieRequest é o payload de PATCH /sessoes/:id/series (role=ALUNO).
//
// Limites alinhados com o schema Zod em @amfit/shared:
//   - numero_serie: 1..20 (mesmo limite de Series no item_treino)
//   - repeticoes_realizadas: 0..200 (sanidade — ninguém faz 201 reps)
//
// CargaRealizada / RepeticoesRealizadas são opcionais — o aluno pode marcar
// "concluída" sem informar números (ex.: peso corporal sem medição precisa).
type RegistrarSerieRequest struct {
	ItemTreinoID         string   `json:"item_treino_id" validate:"required,uuid"`
	NumeroSerie          int      `json:"numero_serie" validate:"required,min=1,max=20"`
	Concluida            bool     `json:"concluida"`
	CargaRealizada       *float64 `json:"carga_realizada,omitempty" validate:"omitempty,min=0"`
	RepeticoesRealizadas *int     `json:"repeticoes_realizadas,omitempty" validate:"omitempty,min=0,max=200"`
}

// ── Responses ─────────────────────────────────────────────────────────────

// SessaoResponse é o DTO de saída para uma sessão completa (com todas as
// séries já registradas). Usado em IniciarSessao, BuscarSessao e ConcluirSessao.
type SessaoResponse struct {
	ID           string                  `json:"id"`
	TreinoID     string                  `json:"treino_id"`
	DataExecucao string                  `json:"data_execucao"` // YYYY-MM-DD
	Status       string                  `json:"status"`
	IniciadoEm   time.Time               `json:"iniciado_em"`
	ConcluidoEm  *time.Time              `json:"concluido_em,omitempty"`
	Series       []RegistroSerieResponse `json:"series"`
}

// RegistroSerieResponse é o DTO de saída para uma série registrada.
type RegistroSerieResponse struct {
	ID                   string     `json:"id"`
	ItemTreinoID         string     `json:"item_treino_id"`
	NumeroSerie          int        `json:"numero_serie"`
	Concluida            bool       `json:"concluida"`
	CargaRealizada       *float64   `json:"carga_realizada,omitempty"`
	RepeticoesRealizadas *int       `json:"repeticoes_realizadas,omitempty"`
	ExecutadoEm          *time.Time `json:"executado_em,omitempty"`
}

// SessaoResumoResponse é a projeção usada no histórico — sem séries detalhadas,
// apenas contadores (TotalSeries / SeriesConcluidas) + metadados do treino.
type SessaoResumoResponse struct {
	ID               string     `json:"id"`
	TreinoID         string     `json:"treino_id"`
	TreinoLetra      string     `json:"treino_letra"`
	TreinoNome       string     `json:"treino_nome,omitempty"`
	DataExecucao     string     `json:"data_execucao"`
	Status           string     `json:"status"`
	IniciadoEm       time.Time  `json:"iniciado_em"`
	ConcluidoEm      *time.Time `json:"concluido_em,omitempty"`
	TotalSeries      int        `json:"total_series"`
	SeriesConcluidas int        `json:"series_concluidas"`
}

// SessaoListResponse encapsula o histórico paginado.
type SessaoListResponse struct {
	Data       []SessaoResumoResponse `json:"data"`
	Pagination Pagination             `json:"pagination"`
}

// Pagination é o envelope de paginação compartilhado entre listagens.
type Pagination struct {
	Total   int `json:"total"`
	Page    int `json:"page"`
	PerPage int `json:"per_page"`
}
