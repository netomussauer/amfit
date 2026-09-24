-- Rollback: 000012_personal_codigo
ALTER TABLE personal_trainer DROP CONSTRAINT IF EXISTS personal_trainer_codigo_key;
ALTER TABLE personal_trainer DROP COLUMN IF EXISTS codigo;
