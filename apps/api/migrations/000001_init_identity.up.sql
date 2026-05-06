-- Migration: 000001_init_identity
-- Cria as tabelas do bounded context Identity.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE personal_trainer (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome          TEXT        NOT NULL,
    email         TEXT        NOT NULL UNIQUE,
    telefone      TEXT,
    cref          TEXT,
    ativo         BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE owner_type AS ENUM ('PERSONAL', 'ALUNO');
CREATE TYPE sexo_tipo AS ENUM ('M', 'F', 'OUTRO');

CREATE TABLE aluno (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    personal_id      UUID        NOT NULL REFERENCES personal_trainer(id) ON DELETE RESTRICT,
    nome             TEXT        NOT NULL,
    email            TEXT        NOT NULL UNIQUE,
    data_nascimento  DATE,
    sexo             sexo_tipo,
    telefone         TEXT,
    ativo            BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE credencial (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      UUID        NOT NULL,
    owner_type    owner_type  NOT NULL,
    password_hash TEXT        NOT NULL,
    ultimo_acesso TIMESTAMPTZ,
    UNIQUE (owner_id, owner_type)
);

CREATE TABLE refresh_token (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id  UUID        NOT NULL,
    jti       TEXT        NOT NULL UNIQUE,
    expira_em TIMESTAMPTZ NOT NULL,
    revogado  BOOLEAN     NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_refresh_owner ON refresh_token(owner_id) WHERE revogado = FALSE;
CREATE INDEX idx_aluno_personal ON aluno(personal_id) WHERE ativo = TRUE;
