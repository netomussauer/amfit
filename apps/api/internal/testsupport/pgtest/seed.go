package pgtest

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Seed insere dados-base direto por SQL, sem passar pelos repositórios dos
// contextos — assim os testes de um contexto não dependem do código de outro
// (e podem montar estados que a API não permitiria, como uma ficha expirada).
type Seed struct {
	T    testing.TB
	Pool *pgxpool.Pool
	Ctx  context.Context
}

// NewSeed cria o helper sobre um pool de NewDB.
func NewSeed(t testing.TB, pool *pgxpool.Pool) *Seed {
	return &Seed{T: t, Pool: pool, Ctx: context.Background()}
}

// Exec executa SQL arbitrário e falha o teste em caso de erro.
func (s *Seed) Exec(sql string, args ...any) {
	s.T.Helper()
	if _, err := s.Pool.Exec(s.Ctx, sql, args...); err != nil {
		s.T.Fatalf("seed: %v\nSQL: %s", err, sql)
	}
}

// Hoje devolve CURRENT_DATE do próprio banco (evita divergência de fuso entre
// o relógio do Go e o do container nas regras de vigência).
func (s *Seed) Hoje() time.Time {
	s.T.Helper()
	var d time.Time
	if err := s.Pool.QueryRow(s.Ctx, `SELECT CURRENT_DATE`).Scan(&d); err != nil {
		s.T.Fatalf("seed: CURRENT_DATE: %v", err)
	}
	return d
}

// Dias devolve Hoje() deslocado em n dias.
func (s *Seed) Dias(n int) time.Time { return s.Hoje().AddDate(0, 0, n) }

// Personal cria um personal_trainer com e-mail e código únicos.
func (s *Seed) Personal() uuid.UUID {
	id := uuid.New()
	s.Exec(`INSERT INTO personal_trainer (id, nome, email, codigo) VALUES ($1, 'Personal', $2, $3)`,
		id, id.String()+"@p.test", id.String()[:8])
	return id
}

// Aluno cria um aluno ativo do personal.
func (s *Seed) Aluno(personal uuid.UUID) uuid.UUID {
	id := uuid.New()
	s.Exec(`INSERT INTO aluno (id, personal_id, nome, email) VALUES ($1, $2, 'Aluno', $3)`,
		id, personal, id.String()+"@a.test")
	return id
}

// Grupo devolve um grupo_muscular da seed das migrations.
func (s *Seed) Grupo() uuid.UUID {
	s.T.Helper()
	var id uuid.UUID
	if err := s.Pool.QueryRow(s.Ctx, `SELECT id FROM grupo_muscular ORDER BY nome LIMIT 1`).Scan(&id); err != nil {
		s.T.Fatalf("seed: grupo_muscular: %v", err)
	}
	return id
}

// Exercicio cria um exercício; personal == nil => global.
func (s *Seed) Exercicio(nome string, personal *uuid.UUID) uuid.UUID {
	id := uuid.New()
	s.Exec(`INSERT INTO exercicio (id, personal_id, nome, grupo_muscular_id) VALUES ($1, $2, $3, $4)`,
		id, personal, nome, s.Grupo())
	return id
}

// Ficha cria uma ficha_treino.
func (s *Seed) Ficha(personal, aluno uuid.UUID, inicio time.Time, fim *time.Time, ativa bool) uuid.UUID {
	id := uuid.New()
	s.Exec(`INSERT INTO ficha_treino (id, aluno_id, personal_id, nome, vigencia_inicio, vigencia_fim, ativa)
	        VALUES ($1, $2, $3, 'Ficha', $4, $5, $6)`, id, aluno, personal, inicio, fim, ativa)
	return id
}

// FichaVigente cria uma ficha ativa que começou ontem e não tem fim.
func (s *Seed) FichaVigente(personal, aluno uuid.UUID) uuid.UUID {
	return s.Ficha(personal, aluno, s.Dias(-1), nil, true)
}

// Treino cria um treino na ficha.
func (s *Seed) Treino(ficha uuid.UUID, letra string, ordem int) uuid.UUID {
	id := uuid.New()
	s.Exec(`INSERT INTO treino (id, ficha_id, letra, ordem) VALUES ($1, $2, $3, $4)`, id, ficha, letra, ordem)
	return id
}

// Item cria um item_treino com o número de séries informado.
func (s *Seed) Item(treino, exercicio uuid.UUID, ordem, series int) uuid.UUID {
	id := uuid.New()
	s.Exec(`INSERT INTO item_treino (id, treino_id, exercicio_id, ordem, series, repeticoes)
	        VALUES ($1, $2, $3, $4, $5, '10')`, id, treino, exercicio, ordem, series)
	return id
}

// Sessao cria uma sessao_treino com o status informado.
func (s *Seed) Sessao(aluno, treino uuid.UUID, data time.Time, status string, concluidoEm *time.Time) uuid.UUID {
	id := uuid.New()
	s.Exec(`INSERT INTO sessao_treino (id, aluno_id, treino_id, data_execucao, status, concluido_em)
	        VALUES ($1, $2, $3, $4, $5::status_sessao, $6)`, id, aluno, treino, data, status, concluidoEm)
	return id
}
