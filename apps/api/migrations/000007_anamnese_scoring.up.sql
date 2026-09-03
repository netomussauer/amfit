-- Migration: 000007_anamnese_scoring
-- Substitui o stub de `anamnese` (fase 2, nunca implementado) pelo design
-- de "Anamnese Inteligente com Scoring" do SDD (docs/SDD.md §20.2): a
-- tabela ganha `respostas_json` + `score_calculado` + `nivel_sugerido`
-- (calculados no backend, nunca pelo cliente — ver domain/anamnese.go),
-- e cria o par template_treino/template_item usado para sugerir uma ficha
-- pronta compativel com o nivel/objetivo apurado.
--
-- A tabela `anamnese` original nunca teve repositorio/service implementado
-- (so a struct Go e a migration existiam) — seguro fazer DROP+CREATE em vez
-- de ALTER, sem risco de dado real perdido.

DROP TABLE IF EXISTS anamnese;

CREATE TYPE nivel_anamnese AS ENUM ('INICIANTE', 'INTERMEDIARIO', 'AVANCADO');
CREATE TYPE origem_template AS ENUM ('SISTEMA', 'PERSONAL');

CREATE TABLE anamnese (
    id                           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    aluno_id                     UUID           NOT NULL UNIQUE REFERENCES aluno(id) ON DELETE CASCADE,
    objetivo                     TEXT           NOT NULL,
    lesoes                       TEXT,
    doencas_preexistentes        TEXT,
    medicamentos                 TEXT,
    pratica_outro_esporte        BOOLEAN        NOT NULL DEFAULT FALSE,
    outro_esporte                TEXT,
    frequencia_semanas_anterior  INTEGER,
    observacoes_gerais           TEXT,
    respostas_json                JSONB         NOT NULL,
    score_calculado                INTEGER      NOT NULL,
    nivel_sugerido                  nivel_anamnese NOT NULL,
    preenchido_em                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE template_treino (
    id           UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    nome         TEXT             NOT NULL,
    nivel        nivel_anamnese   NOT NULL,
    objetivo     TEXT             NOT NULL,
    criado_por   origem_template  NOT NULL DEFAULT 'SISTEMA',
    personal_id  UUID             REFERENCES personal_trainer(id) ON DELETE CASCADE,
    ativo        BOOLEAN          NOT NULL DEFAULT TRUE,
    criado_em    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

    -- Template global do sistema (criado_por=SISTEMA) nao pertence a nenhum
    -- personal; template customizado (criado_por=PERSONAL) sempre pertence
    -- a um. Evita o estado ambiguo "PERSONAL sem dono".
    CONSTRAINT chk_template_personal_id CHECK (
        (criado_por = 'SISTEMA' AND personal_id IS NULL) OR
        (criado_por = 'PERSONAL' AND personal_id IS NOT NULL)
    )
);

CREATE TABLE template_item (
    id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id       UUID    NOT NULL REFERENCES template_treino(id) ON DELETE CASCADE,
    exercicio_id      UUID    NOT NULL REFERENCES exercicio(id) ON DELETE RESTRICT,
    treino_letra      TEXT    NOT NULL,
    ordem             INTEGER NOT NULL DEFAULT 0,
    series            INTEGER NOT NULL,
    repeticoes        TEXT    NOT NULL,
    carga_sugerida    NUMERIC(6,2),
    descanso_segundos INTEGER
);

-- Query de match (POST /alunos/{id}/anamnese): WHERE nivel=X AND objetivo=Y
-- AND ativo=TRUE, priorizando criado_por='PERSONAL' do personal solicitante.
CREATE INDEX idx_template_treino_match ON template_treino(nivel, objetivo) WHERE ativo = TRUE;
CREATE INDEX idx_template_item_template ON template_item(template_id, treino_letra, ordem);

-- ── Seed: exercicios globais minimos para os templates do sistema ──────────
-- Sem isso a tabela `exercicio` fica vazia em uma instalacao nova (nunca
-- houve seed global — so exercicios custom por personal) e os templates
-- SISTEMA abaixo nao teriam o que referenciar.
INSERT INTO exercicio (id, personal_id, nome, grupo_muscular_id, ativo) VALUES
    ('a0000000-0000-4000-8000-000000000001', NULL, 'Supino Reto',       (SELECT id FROM grupo_muscular WHERE nome = 'Peitoral'), TRUE),
    ('a0000000-0000-4000-8000-000000000002', NULL, 'Remada Curvada',    (SELECT id FROM grupo_muscular WHERE nome = 'Costas'), TRUE),
    ('a0000000-0000-4000-8000-000000000003', NULL, 'Agachamento Livre', (SELECT id FROM grupo_muscular WHERE nome = 'Quadríceps'), TRUE),
    ('a0000000-0000-4000-8000-000000000004', NULL, 'Elevação Lateral',  (SELECT id FROM grupo_muscular WHERE nome = 'Ombros'), TRUE),
    ('a0000000-0000-4000-8000-000000000005', NULL, 'Rosca Direta',      (SELECT id FROM grupo_muscular WHERE nome = 'Bíceps'), TRUE),
    ('a0000000-0000-4000-8000-000000000006', NULL, 'Tríceps Corda',     (SELECT id FROM grupo_muscular WHERE nome = 'Tríceps'), TRUE)
ON CONFLICT (id) DO NOTHING;

-- ── Seed: templates globais (um por combinacao nivel/objetivo mais comum) ──
INSERT INTO template_treino (id, nome, nivel, objetivo, criado_por, personal_id) VALUES
    ('b0000000-0000-4000-8000-000000000001', 'Full Body Iniciante',        'INICIANTE',     'condicionamento', 'SISTEMA', NULL),
    ('b0000000-0000-4000-8000-000000000002', 'Hipertrofia AB Intermediário', 'INTERMEDIARIO', 'hipertrofia',      'SISTEMA', NULL),
    ('b0000000-0000-4000-8000-000000000003', 'Força ABC Avançado',         'AVANCADO',      'forca',            'SISTEMA', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO template_item (id, template_id, exercicio_id, treino_letra, ordem, series, repeticoes) VALUES
    -- Full Body Iniciante (A)
    ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'A', 0, 3, '10-12'),
    ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'A', 1, 3, '10-12'),
    ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'A', 2, 3, '12-15'),
    ('c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'A', 3, 3, '12-15'),
    -- Hipertrofia AB Intermediário (A: peito/tríceps, B: costas/bíceps)
    ('c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'A', 0, 4, '8-10'),
    ('c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000006', 'A', 1, 3, '10-12'),
    ('c0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'B', 0, 4, '8-10'),
    ('c0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000005', 'B', 1, 3, '10-12'),
    -- Força ABC Avançado
    ('c0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'A', 0, 5, '5'),
    ('c0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'B', 0, 5, '5'),
    ('c0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', 'C', 0, 5, '5')
ON CONFLICT (id) DO NOTHING;
