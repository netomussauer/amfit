package domain

import (
	"context"

	"github.com/google/uuid"
)

// PushTokenRepository persiste tokens Expo Push.
type PushTokenRepository interface {
	// Upsert insere ou reativa um token por (owner_id, owner_tipo, token) —
	// mesmo device re-registrando (reinstalação, refresh) não acumula
	// duplicata.
	Upsert(ctx context.Context, t *PushToken) error

	// ListaAtivosPorOwner devolve os tokens ativos de um destinatário —
	// usado pelo worker para saber pra onde despachar.
	ListaAtivosPorOwner(ctx context.Context, ownerID uuid.UUID, ownerTipo OwnerTipo) ([]PushToken, error)
}

// NotificacaoRepository persiste a fila de notificações.
type NotificacaoRepository interface {
	// Criar insere uma notificação com status PENDENTE.
	Criar(ctx context.Context, n *Notificacao) error

	// ListarPendentes devolve até `limit` notificações com status
	// PENDENTE, mais antigas primeiro — usado pelo polling do worker.
	ListarPendentes(ctx context.Context, limit int) ([]Notificacao, error)

	// MarcarEnviada marca a notificação como ENVIADA, preenchendo
	// enviado_em. Também usada quando o destinatário não tem nenhum token
	// ativo — "notificação é silenciosa se não houver token" (SDD §13.2):
	// não é um erro, só não há pra onde despachar.
	MarcarEnviada(ctx context.Context, id uuid.UUID) error

	// MarcarErro marca a notificação como ERRO com o detalhe da falha —
	// não é reprocessada automaticamente (evita loop de erro permanente
	// contra um token/endpoint quebrado).
	MarcarErro(ctx context.Context, id uuid.UUID, detalhe string) error
}
