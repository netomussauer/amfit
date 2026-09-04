-- Migration: 000009_tenant_config
-- Cria a tabela do White Label (SDD docs/SDD.md §20.4): branding
-- (logo/cores/nome do app) por personal, 1:1 com personal_trainer.
--
-- Escopo desta entrega: sem `dominio_customizado` (Traefik IngressRoute
-- dinamica + cert-manager por dominio e infra de cluster, nao codigo de
-- app) e sem o fluxo publico "GET por codigo" do SDD (nao existe conceito
-- de codigo/slug do personal nem fluxo de convite/QR-code neste app —
-- alunos sao criados diretamente pelo personal). A resolucao de branding
-- pro aluno usa o proprio JWT autenticado (ver identity/application/
-- tenant_service.go, ObterConfig).

CREATE TABLE tenant_config (
    personal_id     UUID        PRIMARY KEY REFERENCES personal_trainer(id) ON DELETE CASCADE,
    logo_url        TEXT,
    cor_primaria    TEXT        NOT NULL DEFAULT 'f97316',
    cor_secundaria  TEXT        NOT NULL DEFAULT 'ea580c',
    nome_app        TEXT,
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
