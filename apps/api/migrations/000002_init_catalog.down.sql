-- Rollback: 000002_init_catalog

DROP INDEX IF EXISTS idx_exercicio_global;
DROP INDEX IF EXISTS idx_exercicio_personal;

DROP TABLE IF EXISTS exercicio;
DROP TABLE IF EXISTS grupo_muscular;

DROP TYPE IF EXISTS tipo_midia;
