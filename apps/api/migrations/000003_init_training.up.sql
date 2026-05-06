-- Migration: 000003_init_training
-- Cria as tabelas do bounded context Training.

CREATE TABLE ficha_treino (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id        UUID        NOT NULL REFERENCES aluno(id) ON DELETE CASCADE,
    personal_id     UUID        NOT NULL REFERENCES personal_trainer(id) ON DELETE RESTRICT,
    nome            TEXT        NOT NULL,
    vigencia_inicio DATE        NOT NULL,
    vigencia_fim    DATE,
    ativa           BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE treino (
    id       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    ficha_id UUID    NOT NULL REFERENCES ficha_treino(id) ON DELETE CASCADE,
    letra    TEXT    NOT NULL,
    nome     TEXT,
    ordem    INTEGER NOT NULL DEFAULT 0,
    UNIQUE (ficha_id, letra)
);

CREATE TABLE item_treino (
    id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    treino_id         UUID    NOT NULL REFERENCES treino(id) ON DELETE CASCADE,
    exercicio_id      UUID    NOT NULL REFERENCES exercicio(id) ON DELETE RESTRICT,
    ordem             INTEGER NOT NULL DEFAULT 0,
    series            INTEGER NOT NULL,
    repeticoes        TEXT    NOT NULL,
    carga_sugerida    NUMERIC(6,2),
    descanso_segundos INTEGER,
    observacao        TEXT
);

-- Fichas ativas por aluno (consulta principal do app mobile)
CREATE INDEX idx_ficha_aluno_ativa ON ficha_treino(aluno_id) WHERE ativa = TRUE;
CREATE INDEX idx_item_treino_treino ON item_treino(treino_id, ordem);
