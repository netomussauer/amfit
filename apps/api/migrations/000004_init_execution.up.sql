-- Migration: 000004_init_execution
-- Cria as tabelas do bounded context Execution.

CREATE TYPE status_sessao AS ENUM ('EM_ANDAMENTO', 'CONCLUIDO', 'ABANDONADO');

CREATE TABLE sessao_treino (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id       UUID          NOT NULL REFERENCES aluno(id) ON DELETE CASCADE,
    treino_id      UUID          NOT NULL REFERENCES treino(id) ON DELETE RESTRICT,
    data_execucao  DATE          NOT NULL,
    status         status_sessao NOT NULL DEFAULT 'EM_ANDAMENTO',
    iniciado_em    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    concluido_em   TIMESTAMPTZ,
    observacao     TEXT
);

CREATE TABLE registro_serie (
    id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sessao_id              UUID        NOT NULL REFERENCES sessao_treino(id) ON DELETE CASCADE,
    item_treino_id         UUID        NOT NULL REFERENCES item_treino(id) ON DELETE RESTRICT,
    numero_serie           INTEGER     NOT NULL,
    carga_realizada        NUMERIC(6,2),
    repeticoes_realizadas  INTEGER,
    concluida              BOOLEAN     NOT NULL DEFAULT FALSE,
    executado_em           TIMESTAMPTZ,
    UNIQUE (sessao_id, item_treino_id, numero_serie)
);

-- Sessões por aluno e data (dashboard + histórico)
CREATE INDEX idx_sessao_aluno_data ON sessao_treino(aluno_id, data_execucao DESC);

-- Evolução de carga por item de treino (gráfico de progresso)
CREATE INDEX idx_registro_item_sessao ON registro_serie(item_treino_id, sessao_id);
