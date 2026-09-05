-- Migration: 000011_coach_context
-- Cria as tabelas do bounded context Coach (SDD docs/SDD.md Sec20.5, Coach
-- Assincrono por Video): o aluno envia um clipe de ate 60s pedindo revisao
-- de execucao, o personal assiste e responde com feedback.
--
-- Escopo desta entrega: sem integracao com Chat (contexto que nao existe
-- neste codebase ainda — nenhuma tabela canal/mensagem foi implementada).
-- O feedback vive direto em coach_video_feedback e chega ao aluno via
-- push notification (Notification context), nao como mensagem num canal.
-- Tambem sem feedback em audio ainda (so texto) — por isso nao ha coluna
-- audio_object_key aqui; adiciona-la depois nao exige alterar esta tabela.
--
-- `item_treino_id` fica nullable e SEM validacao de posse no service — o
-- app so envia o item_treino_id da propria ficha do aluno, e uma violacao
-- de FK (item_treino inexistente) e traduzida pelo repository num erro de
-- dominio (ErrItemTreinoInvalido) em vez de propagar um 500 cru.

CREATE TYPE status_coach_video AS ENUM ('AGUARDANDO_FEEDBACK', 'FEEDBACK_ENVIADO', 'ARQUIVADO');

CREATE TABLE coach_video (
    id                UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id          UUID                NOT NULL REFERENCES aluno(id) ON DELETE CASCADE,
    personal_id       UUID                NOT NULL REFERENCES personal_trainer(id) ON DELETE CASCADE,
    item_treino_id    UUID                REFERENCES item_treino(id) ON DELETE SET NULL,
    video_object_key  TEXT                NOT NULL,
    duracao_segundos  INT                 NOT NULL CHECK (duracao_segundos > 0 AND duracao_segundos <= 60),
    status            status_coach_video  NOT NULL DEFAULT 'AGUARDANDO_FEEDBACK',
    descricao         TEXT,
    criado_em         TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    atualizado_em     TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- Lista "aguardando feedback" do personal (tela principal do recurso).
CREATE INDEX idx_coach_video_personal_status ON coach_video(personal_id, status, criado_em DESC);
CREATE INDEX idx_coach_video_aluno ON coach_video(aluno_id, criado_em DESC);

CREATE TABLE coach_video_feedback (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id    UUID        NOT NULL UNIQUE REFERENCES coach_video(id) ON DELETE CASCADE,
    personal_id UUID        NOT NULL REFERENCES personal_trainer(id) ON DELETE CASCADE,
    texto       TEXT        NOT NULL,
    enviado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
