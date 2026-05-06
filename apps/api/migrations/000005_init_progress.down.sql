-- Rollback: 000005_init_progress

DROP INDEX IF EXISTS idx_medida_aluno_data;

DROP TABLE IF EXISTS anamnese;
DROP TABLE IF EXISTS medida_corporal;
