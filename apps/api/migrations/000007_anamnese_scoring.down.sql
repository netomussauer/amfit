-- Rollback: 000007_anamnese_scoring

DROP INDEX IF EXISTS idx_template_item_template;
DROP INDEX IF EXISTS idx_template_treino_match;

DROP TABLE IF EXISTS template_item;
DROP TABLE IF EXISTS template_treino;

DELETE FROM exercicio WHERE id IN (
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000004',
    'a0000000-0000-4000-8000-000000000005',
    'a0000000-0000-4000-8000-000000000006'
);

DROP TABLE IF EXISTS anamnese;

DROP TYPE IF EXISTS origem_template;
DROP TYPE IF EXISTS nivel_anamnese;

-- Restaura o shape original (stub da fase 2, nunca implementado).
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
