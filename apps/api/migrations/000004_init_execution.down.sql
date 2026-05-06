-- Rollback: 000004_init_execution

DROP INDEX IF EXISTS idx_registro_item_sessao;
DROP INDEX IF EXISTS idx_sessao_aluno_data;

DROP TABLE IF EXISTS registro_serie;
DROP TABLE IF EXISTS sessao_treino;

DROP TYPE IF EXISTS status_sessao;
