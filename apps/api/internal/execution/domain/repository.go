package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// SessaoRepository define o contrato de persistência para SessaoTreino.
type SessaoRepository interface {
	// Create persiste uma nova sessão. Espera-se que o ID já esteja gerado.
	Create(ctx context.Context, s *SessaoTreino) error

	// FindByID retorna a sessão pelo ID. Retorna ErrSessaoNotFound se não existir.
	FindByID(ctx context.Context, id uuid.UUID) (*SessaoTreino, error)

	// FindEmAndamentoHoje busca uma sessão EM_ANDAMENTO do dia atual para o
	// par (aluno, treino). É a base da idempotência de IniciarSessao —
	// chamadas repetidas no mesmo dia devolvem a mesma sessão. Retorna
	// ErrSessaoNotFound quando não existe.
	FindEmAndamentoHoje(ctx context.Context, alunoID, treinoID uuid.UUID) (*SessaoTreino, error)

	// UpdateStatus atualiza o status e (opcionalmente) o concluido_em.
	// Quando concluidoEm == nil o campo NÃO é alterado (UPDATE seletivo).
	// Retorna ErrSessaoNotFound se nenhuma linha foi afetada.
	UpdateStatus(ctx context.Context, id uuid.UUID, status StatusSessao, concluidoEm *time.Time) error

	// ListByAluno devolve as sessões do aluno paginadas, em ordem decrescente
	// de data_execucao + iniciado_em, junto com o total para a paginação.
	ListByAluno(ctx context.Context, alunoID uuid.UUID, page, perPage int) ([]*SessaoComResumo, int, error)
}

// RegistroSerieRepository define o contrato de persistência para RegistroSerie.
type RegistroSerieRepository interface {
	// Upsert insere ou atualiza um registro identificado pela tripla
	// (sessao_id, item_treino_id, numero_serie). Encontra-se a UNIQUE
	// dessa tripla na migration 000004 — o INSERT usa ON CONFLICT.
	Upsert(ctx context.Context, r *RegistroSerie) error

	// ListBySessao devolve todos os registros de uma sessão, ordenados por
	// item_treino_id e numero_serie.
	ListBySessao(ctx context.Context, sessaoID uuid.UUID) ([]*RegistroSerie, error)

	// CountBySessao retorna (concluidas, total) — usado em métricas e nos
	// resumos de listagem (read-model agregado).
	CountBySessao(ctx context.Context, sessaoID uuid.UUID) (concluidas, total int, err error)
}

// TreinoLookup abstrai a leitura de dados do contexto Training necessários
// pelo Execution. É um port próprio (sem importar training/domain) para
// manter os bounded contexts desacoplados em código — o adapter SQL faz
// queries diretas nas tabelas treino/item_treino/ficha_treino.
type TreinoLookup interface {
	// GetTreinoComItens carrega letra, nome e a projeção mínima dos itens
	// (ID + Series) — suficiente para validar o numero_serie de RegistrarSerie.
	GetTreinoComItens(ctx context.Context, treinoID uuid.UUID) (letra, nome string, itens []ItemBasico, err error)

	// ValidarTreinoDoAluno responde se treino_id pertence à ficha ATIVA do
	// aluno hoje. Usado pela idempotência de IniciarSessao.
	ValidarTreinoDoAluno(ctx context.Context, alunoID, treinoID uuid.UUID) (bool, error)
}
