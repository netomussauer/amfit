-- Rollback: 000001_init_identity
-- Remove as tabelas do contexto Identity na ordem inversa de dependência.

DROP INDEX IF EXISTS idx_aluno_personal;
DROP INDEX IF EXISTS idx_refresh_owner;

DROP TABLE IF EXISTS refresh_token;
DROP TABLE IF EXISTS credencial;
DROP TABLE IF EXISTS aluno;
DROP TABLE IF EXISTS personal_trainer;

DROP TYPE IF EXISTS sexo_tipo;
DROP TYPE IF EXISTS owner_type;
