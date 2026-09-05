package application

import "time"

// EnviarVideoRequest é o payload (campos de texto) de POST /coach/videos —
// multipart/form-data, então o handler monta este struct a partir de
// form.Value em vez de bind de JSON (mesmo padrão de identity's
// AtualizarTenantConfigRequest).
type EnviarVideoRequest struct {
	ItemTreinoID    string `validate:"omitempty,uuid"`
	Descricao       string `validate:"omitempty,max=500"`
	DuracaoSegundos int    `validate:"required,min=1,max=60"`
}

// EnviarFeedbackRequest é o payload de POST /coach/videos/{id}/feedback.
type EnviarFeedbackRequest struct {
	Texto string `json:"texto" validate:"required,min=1,max=2000"`
}

// CoachVideoFeedbackResponse é o DTO de saída para o feedback de um vídeo.
type CoachVideoFeedbackResponse struct {
	Texto     string    `json:"texto"`
	EnviadoEm time.Time `json:"enviado_em"`
}

// CoachVideoResponse é o DTO de saída para um CoachVideo.
type CoachVideoResponse struct {
	ID              string                      `json:"id"`
	AlunoID         string                      `json:"aluno_id"`
	AlunoNome       string                      `json:"aluno_nome,omitempty"`
	ItemTreinoID    *string                     `json:"item_treino_id,omitempty"`
	ExercicioNome   *string                     `json:"exercicio_nome,omitempty"`
	VideoURL        string                      `json:"video_url"`
	DuracaoSegundos int                         `json:"duracao_segundos"`
	Status          string                      `json:"status"`
	Descricao       string                      `json:"descricao,omitempty"`
	CriadoEm        time.Time                   `json:"criado_em"`
	Feedback        *CoachVideoFeedbackResponse `json:"feedback,omitempty"`
}

// Pagination descreve metadados de paginação — mesma forma usada nos
// demais contextos, redefinida aqui porque cada bounded context é um
// pacote Go isolado.
type Pagination struct {
	Total   int `json:"total"`
	Page    int `json:"page"`
	PerPage int `json:"per_page"`
}

// CoachVideoListResponse encapsula uma página de vídeos.
type CoachVideoListResponse struct {
	Data       []CoachVideoResponse `json:"data"`
	Pagination Pagination           `json:"pagination"`
}
