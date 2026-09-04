-- Rollback: 000008_notification_context

DROP INDEX IF EXISTS idx_notificacao_pendente;
DROP TABLE IF EXISTS notificacao;

DROP INDEX IF EXISTS idx_push_token_owner_ativo;
DROP TABLE IF EXISTS push_token;

DROP TYPE IF EXISTS status_entrega_notificacao;
DROP TYPE IF EXISTS plataforma_dispositivo;
-- owner_type pertence a 000001_init_identity (reaproveitado aqui) — não é
-- desta migration para dropar.
