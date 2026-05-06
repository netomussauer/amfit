-- Migration: 000002_init_catalog
-- Cria as tabelas do bounded context Catalog.

CREATE TYPE tipo_midia AS ENUM ('VIDEO', 'GIF', 'IMAGEM');

CREATE TABLE grupo_muscular (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome      TEXT NOT NULL UNIQUE,
    descricao TEXT
);

CREATE TABLE exercicio (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id      UUID        REFERENCES personal_trainer(id) ON DELETE CASCADE,
    nome             TEXT        NOT NULL,
    descricao        TEXT,
    grupo_muscular_id UUID       NOT NULL REFERENCES grupo_muscular(id) ON DELETE RESTRICT,
    midia_url        TEXT,
    tipo_midia       tipo_midia,
    ativo            BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exercícios customizados de um personal (apenas ativos)
CREATE INDEX idx_exercicio_personal ON exercicio(personal_id) WHERE ativo = TRUE;

-- Exercícios globais por grupo muscular (personal_id IS NULL)
CREATE INDEX idx_exercicio_global ON exercicio(grupo_muscular_id) WHERE personal_id IS NULL AND ativo = TRUE;
