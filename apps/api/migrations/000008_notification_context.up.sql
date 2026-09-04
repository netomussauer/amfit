-- Migration: 000008_notification_context
-- Cria as tabelas do bounded context Notification (SDD docs/SDD.md §13.2):
-- registro de push tokens (Expo) e a fila de notificacoes despachada pelo
-- worker em background (internal/notification/worker).
--
-- Escopo desta entrega: so o gatilho TREINO_CONCLUIDO existe de fato hoje.
-- Os demais tipos do SDD (PR_BATIDO, MENSALIDADE_*, MENSAGEM_RECEBIDA,
-- BADGE_DESBLOQUEADO) dependem de logica/contextos que ainda nao existem
-- no codebase (deteccao de recorde pessoal, modulo financeiro, chat,
-- gamificacao) — por isso `tipo` fica TEXT livre (nao ENUM fechado),
-- pra nao exigir uma migration nova a cada novo tipo adicionado depois.
--
-- Reaproveita o ENUM `owner_type` ja criado em 000001_init_identity (usado
-- por refresh_token) em vez de criar um `owner_tipo` duplicado com os
-- mesmos valores — mesmo vocabulario (PERSONAL|ALUNO), mesmo dono
-- conceitual, um enum so.

CREATE TYPE plataforma_dispositivo AS ENUM ('ANDROID', 'IOS');
CREATE TYPE status_entrega_notificacao AS ENUM ('PENDENTE', 'ENVIADA', 'ERRO');

CREATE TABLE push_token (
    id             UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id       UUID                    NOT NULL,
    owner_tipo     owner_type              NOT NULL,
    token          TEXT                    NOT NULL,
    plataforma     plataforma_dispositivo  NOT NULL,
    ativo          BOOLEAN                 NOT NULL DEFAULT TRUE,
    registrado_em  TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    atualizado_em  TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    -- Mesmo device pode re-registrar (reinstalação, refresh de token do
    -- Expo) — upsert por (owner, token) em vez de acumular duplicatas.
    UNIQUE (owner_id, owner_tipo, token)
);

-- Busca do worker: tokens ativos de um destinatário.
CREATE INDEX idx_push_token_owner_ativo ON push_token(owner_id, owner_tipo) WHERE ativo = TRUE;

CREATE TABLE notificacao (
    id                UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    destinatario_id   UUID                        NOT NULL,
    destinatario_tipo owner_type                  NOT NULL,
    titulo            TEXT                        NOT NULL,
    corpo             TEXT                        NOT NULL,
    tipo              TEXT                        NOT NULL,
    dados_extras      JSONB,
    status            status_entrega_notificacao  NOT NULL DEFAULT 'PENDENTE',
    erro_detalhe      TEXT,
    criado_em         TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    enviado_em        TIMESTAMPTZ
);

-- Polling do worker (a cada 30s, ver internal/notification/worker/dispatcher.go).
CREATE INDEX idx_notificacao_pendente ON notificacao(criado_em) WHERE status = 'PENDENTE';
