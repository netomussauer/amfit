// Package infrastructure contém as implementações de repositório e o
// cliente HTTP para o contexto Notification.
package infrastructure

import (
	"context"
	"fmt"

	"github.com/amfit/api/internal/notification/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresRepositories agrega os repositorios PostgreSQL do contexto Notification.
type PostgresRepositories struct {
	Tokens domain.PushTokenRepository
	Notifs domain.NotificacaoRepository
}

// NewPostgresRepositories cria os repositorios sobre o pool compartilhado.
func NewPostgresRepositories(pool *pgxpool.Pool) *PostgresRepositories {
	return &PostgresRepositories{
		Tokens: &pushTokenRepo{pool: pool},
		Notifs: &notificacaoRepo{pool: pool},
	}
}

// ─── PushToken ───────────────────────────────────────────────────────────

type pushTokenRepo struct {
	pool *pgxpool.Pool
}

const queryUpsertPushToken = `
INSERT INTO push_token (id, owner_id, owner_tipo, token, plataforma, ativo)
VALUES ($1, $2, $3, $4, $5, TRUE)
ON CONFLICT (owner_id, owner_tipo, token) DO UPDATE SET
    plataforma    = EXCLUDED.plataforma,
    ativo         = TRUE,
    atualizado_em = NOW()
RETURNING id, registrado_em, atualizado_em;
`

func (r *pushTokenRepo) Upsert(ctx context.Context, t *domain.PushToken) error {
	err := r.pool.QueryRow(ctx, queryUpsertPushToken,
		t.ID, t.OwnerID, t.OwnerTipo, t.Token, t.Plataforma,
	).Scan(&t.ID, &t.RegistradoEm, &t.AtualizadoEm)
	if err != nil {
		return fmt.Errorf("upsert push token: %w", err)
	}
	return nil
}

const queryListaAtivosPorOwner = `
SELECT id, owner_id, owner_tipo, token, plataforma, ativo, registrado_em, atualizado_em
FROM push_token
WHERE owner_id = $1 AND owner_tipo = $2 AND ativo = TRUE;
`

func (r *pushTokenRepo) ListaAtivosPorOwner(
	ctx context.Context,
	ownerID uuid.UUID,
	ownerTipo domain.OwnerTipo,
) ([]domain.PushToken, error) {
	rows, err := r.pool.Query(ctx, queryListaAtivosPorOwner, ownerID, ownerTipo)
	if err != nil {
		return nil, fmt.Errorf("lista push tokens ativos: %w", err)
	}
	defer rows.Close()

	out := make([]domain.PushToken, 0)
	for rows.Next() {
		var t domain.PushToken
		if err := rows.Scan(
			&t.ID, &t.OwnerID, &t.OwnerTipo, &t.Token, &t.Plataforma,
			&t.Ativo, &t.RegistradoEm, &t.AtualizadoEm,
		); err != nil {
			return nil, fmt.Errorf("scan push token: %w", err)
		}
		out = append(out, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("itera push tokens: %w", err)
	}
	return out, nil
}

// ─── Notificacao ─────────────────────────────────────────────────────────

type notificacaoRepo struct {
	pool *pgxpool.Pool
}

const queryCriarNotificacao = `
INSERT INTO notificacao (
    id, destinatario_id, destinatario_tipo, titulo, corpo, tipo, dados_extras, status
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING criado_em;
`

func (r *notificacaoRepo) Criar(ctx context.Context, n *domain.Notificacao) error {
	err := r.pool.QueryRow(ctx, queryCriarNotificacao,
		n.ID, n.DestinatarioID, n.DestinatarioTipo, n.Titulo, n.Corpo,
		n.Tipo, n.DadosExtras, n.Status,
	).Scan(&n.CriadoEm)
	if err != nil {
		return fmt.Errorf("criar notificacao: %w", err)
	}
	return nil
}

const queryListarPendentes = `
SELECT id, destinatario_id, destinatario_tipo, titulo, corpo, tipo,
       dados_extras, status, erro_detalhe, criado_em, enviado_em
FROM notificacao
WHERE status = 'PENDENTE'
ORDER BY criado_em ASC
LIMIT $1;
`

func (r *notificacaoRepo) ListarPendentes(ctx context.Context, limit int) ([]domain.Notificacao, error) {
	rows, err := r.pool.Query(ctx, queryListarPendentes, limit)
	if err != nil {
		return nil, fmt.Errorf("lista notificacoes pendentes: %w", err)
	}
	defer rows.Close()

	out := make([]domain.Notificacao, 0)
	for rows.Next() {
		var n domain.Notificacao
		if err := rows.Scan(
			&n.ID, &n.DestinatarioID, &n.DestinatarioTipo, &n.Titulo, &n.Corpo,
			&n.Tipo, &n.DadosExtras, &n.Status, &n.ErroDetalhe, &n.CriadoEm, &n.EnviadoEm,
		); err != nil {
			return nil, fmt.Errorf("scan notificacao: %w", err)
		}
		out = append(out, n)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("itera notificacoes pendentes: %w", err)
	}
	return out, nil
}

const queryMarcarEnviada = `
UPDATE notificacao SET status = 'ENVIADA', enviado_em = NOW() WHERE id = $1;
`

func (r *notificacaoRepo) MarcarEnviada(ctx context.Context, id uuid.UUID) error {
	if _, err := r.pool.Exec(ctx, queryMarcarEnviada, id); err != nil {
		return fmt.Errorf("marcar notificacao enviada: %w", err)
	}
	return nil
}

const queryMarcarErro = `
UPDATE notificacao SET status = 'ERRO', erro_detalhe = $2 WHERE id = $1;
`

func (r *notificacaoRepo) MarcarErro(ctx context.Context, id uuid.UUID, detalhe string) error {
	if _, err := r.pool.Exec(ctx, queryMarcarErro, id, detalhe); err != nil {
		return fmt.Errorf("marcar notificacao erro: %w", err)
	}
	return nil
}
