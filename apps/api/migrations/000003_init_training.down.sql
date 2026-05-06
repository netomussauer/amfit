-- Rollback: 000003_init_training

DROP INDEX IF EXISTS idx_item_treino_treino;
DROP INDEX IF EXISTS idx_ficha_aluno_ativa;

DROP TABLE IF EXISTS item_treino;
DROP TABLE IF EXISTS treino;
DROP TABLE IF EXISTS ficha_treino;
