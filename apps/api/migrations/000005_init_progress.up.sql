-- Migration: 000005_init_progress
-- Cria as tabelas do bounded context Progress.

CREATE TABLE medida_corporal (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id         UUID        NOT NULL REFERENCES aluno(id) ON DELETE CASCADE,
    data_medicao     DATE        NOT NULL,
    peso_kg          NUMERIC(5,2),
    altura_cm        NUMERIC(5,2),
    gordura_pct      NUMERIC(5,2),
    massa_magra_kg   NUMERIC(5,2),
    circunferencias  JSONB,
    observacao       TEXT
);

CREATE TABLE anamnese (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id         UUID        NOT NULL UNIQUE REFERENCES aluno(id) ON DELETE CASCADE,
    objetivos        TEXT        NOT NULL DEFAULT '',
    historico_saude  TEXT        NOT NULL DEFAULT '',
    lesoes           TEXT        NOT NULL DEFAULT '',
    medicamentos     TEXT        NOT NULL DEFAULT '',
    nivel_atividade  TEXT        NOT NULL DEFAULT '',
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Medidas por aluno e data (série temporal de progresso)
CREATE INDEX idx_medida_aluno_data ON medida_corporal(aluno_id, data_medicao DESC);
