package application

// ── Requests ──────────────────────────────────────────────────────────────

// CriarFichaRequest é o payload de POST /fichas.
type CriarFichaRequest struct {
	AlunoID        string `json:"aluno_id" validate:"required,uuid"`
	Nome           string `json:"nome" validate:"required,min=2,max=150"`
	VigenciaInicio string `json:"vigencia_inicio" validate:"required,datetime=2006-01-02"`
	VigenciaFim    string `json:"vigencia_fim,omitempty" validate:"omitempty,datetime=2006-01-02"`
}

// AtualizarFichaRequest é o payload de PATCH /fichas/{id}. Cada campo é
// opcional — somente os não-nulos são aplicados. VigenciaFim aceita string
// vazia para "limpar" o campo (ficha sem data de término).
type AtualizarFichaRequest struct {
	Nome           *string `json:"nome,omitempty" validate:"omitempty,min=2,max=150"`
	VigenciaInicio *string `json:"vigencia_inicio,omitempty" validate:"omitempty,datetime=2006-01-02"`
	VigenciaFim    *string `json:"vigencia_fim,omitempty"`
	Ativa          *bool   `json:"ativa,omitempty"`
}

// CriarTreinoRequest é o payload de POST /fichas/{fichaId}/treinos.
type CriarTreinoRequest struct {
	Letra string `json:"letra" validate:"required,min=1,max=2"`
	Nome  string `json:"nome,omitempty" validate:"omitempty,max=100"`
	Ordem int    `json:"ordem"`
}

// AtualizarTreinoRequest é o payload de PATCH /treinos/{id}.
type AtualizarTreinoRequest struct {
	Letra *string `json:"letra,omitempty" validate:"omitempty,min=1,max=2"`
	Nome  *string `json:"nome,omitempty" validate:"omitempty,max=100"`
	Ordem *int    `json:"ordem,omitempty"`
}

// CriarItemTreinoRequest é o payload de POST /treinos/{treinoId}/itens.
type CriarItemTreinoRequest struct {
	ExercicioID      string   `json:"exercicio_id" validate:"required,uuid"`
	Ordem            int      `json:"ordem"`
	Series           int      `json:"series" validate:"required,min=1,max=20"`
	Repeticoes       string   `json:"repeticoes" validate:"required,min=1,max=50"`
	CargaSugerida    *float64 `json:"carga_sugerida,omitempty"`
	DescansoSegundos *int     `json:"descanso_segundos,omitempty" validate:"omitempty,min=0,max=600"`
	Observacao       string   `json:"observacao,omitempty" validate:"omitempty,max=500"`
}

// AtualizarItemTreinoRequest é o payload de PATCH /itens/{id}.
// Todos os campos são opcionais para permitir patch parcial.
type AtualizarItemTreinoRequest struct {
	Ordem            *int     `json:"ordem,omitempty"`
	Series           *int     `json:"series,omitempty" validate:"omitempty,min=1,max=20"`
	Repeticoes       *string  `json:"repeticoes,omitempty" validate:"omitempty,min=1,max=50"`
	CargaSugerida    *float64 `json:"carga_sugerida,omitempty"`
	DescansoSegundos *int     `json:"descanso_segundos,omitempty" validate:"omitempty,min=0,max=600"`
	Observacao       *string  `json:"observacao,omitempty" validate:"omitempty,max=500"`
}

// ReordenarItensRequest é o payload de PATCH /treinos/{treinoId}/itens/reordenar.
// A ordem dos IDs no array define a nova ordem (índice 0 → ordem 0).
type ReordenarItensRequest struct {
	IDs []string `json:"ids" validate:"required,min=1,dive,uuid"`
}

// CriarFichaFromTemplateRequest é o payload de POST /fichas/from-template.
type CriarFichaFromTemplateRequest struct {
	TemplateID     string `json:"template_id" validate:"required,uuid"`
	AlunoID        string `json:"aluno_id" validate:"required,uuid"`
	Nome           string `json:"nome,omitempty" validate:"omitempty,min=2,max=150"`
	VigenciaInicio string `json:"vigencia_inicio" validate:"required,datetime=2006-01-02"`
}

// ── Responses ─────────────────────────────────────────────────────────────

// FichaResponse é o DTO de saída para uma ficha completa.
type FichaResponse struct {
	ID             string           `json:"id"`
	AlunoID        string           `json:"aluno_id"`
	Nome           string           `json:"nome"`
	VigenciaInicio string           `json:"vigencia_inicio"`
	VigenciaFim    *string          `json:"vigencia_fim,omitempty"`
	Ativa          bool             `json:"ativa"`
	Treinos        []TreinoResponse `json:"treinos"`
}

// FichaListResponse encapsula a lista de fichas (sem aninhar treinos).
type FichaListResponse struct {
	Data []FichaResponse `json:"data"`
}

// TreinoResponse é o DTO de saída para um treino com seus itens.
type TreinoResponse struct {
	ID    string               `json:"id"`
	Letra string               `json:"letra"`
	Nome  *string              `json:"nome,omitempty"`
	Ordem int                  `json:"ordem"`
	Itens []ItemTreinoResponse `json:"itens"`
}

// ItemTreinoResponse é o DTO de saída para um item de treino com o exercício
// referenciado já populado.
type ItemTreinoResponse struct {
	ID               string                  `json:"id"`
	Ordem            int                     `json:"ordem"`
	Exercicio        ExercicioResumoResponse `json:"exercicio"`
	Series           int                     `json:"series"`
	Repeticoes       string                  `json:"repeticoes"`
	CargaSugerida    *float64                `json:"carga_sugerida,omitempty"`
	DescansoSegundos *int                    `json:"descanso_segundos,omitempty"`
	Observacao       *string                 `json:"observacao,omitempty"`
}

// ExercicioResumoResponse é a projeção mínima de Exercicio dentro de um
// item de treino. Espelha o schema de @amfit/shared (`ExercicioResponse`).
type ExercicioResumoResponse struct {
	ID            string                `json:"id"`
	Nome          string                `json:"nome"`
	Descricao     string                `json:"descricao,omitempty"`
	GrupoMuscular GrupoMuscularResposta `json:"grupo_muscular"`
	MidiaURL      string                `json:"midia_url,omitempty"`
	TipoMidia     string                `json:"tipo_midia,omitempty"`
	IsGlobal      bool                  `json:"is_global"`
}

// GrupoMuscularResposta evita acoplamento com o pacote catalog/application
// — repete o shape do response porque o contrato JSON é o mesmo.
type GrupoMuscularResposta struct {
	ID   string `json:"id"`
	Nome string `json:"nome"`
}

// TreinoHojeResponse encapsula a resposta de GET /alunos/me/treino-hoje.
// SessaoHojeID será preenchido por Execution (Fase 1.4) — aqui sempre nil.
type TreinoHojeResponse struct {
	Treino       *TreinoResponse `json:"treino"`
	SessaoHojeID *string         `json:"sessao_hoje_id,omitempty"`
}

// TemplateItemResponse é o DTO de saída de um item dentro de um template.
type TemplateItemResponse struct {
	ID               string                  `json:"id"`
	Exercicio        ExercicioResumoResponse `json:"exercicio"`
	TreinoLetra      string                  `json:"treino_letra"`
	Ordem            int                     `json:"ordem"`
	Series           int                     `json:"series"`
	Repeticoes       string                  `json:"repeticoes"`
	CargaSugerida    *float64                `json:"carga_sugerida,omitempty"`
	DescansoSegundos *int                    `json:"descanso_segundos,omitempty"`
}

// TemplateResponse é o DTO de saída de um template de ficha (GET /templates-treino).
type TemplateResponse struct {
	ID        string                 `json:"id"`
	Nome      string                 `json:"nome"`
	Nivel     string                 `json:"nivel"`
	Objetivo  string                 `json:"objetivo"`
	CriadoPor string                 `json:"criado_por"`
	Itens     []TemplateItemResponse `json:"itens"`
}

// TemplateListResponse encapsula a listagem de templates.
type TemplateListResponse struct {
	Data []TemplateResponse `json:"data"`
}
