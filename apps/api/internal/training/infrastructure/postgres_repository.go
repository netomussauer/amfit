// Package infrastructure contém as implementações de repositório para o contexto Training.
package infrastructure

import (
	"context"
	"errors"
	"fmt"

	"github.com/amfit/api/internal/training/application"
	"github.com/amfit/api/internal/training/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// pgUniqueViolation é o SQLSTATE 23505 (unique_violation).
const pgUniqueViolation = "23505"

// PostgresRepositories agrega os repositórios PostgreSQL do contexto Training.
type PostgresRepositories struct {
	pool *pgxpool.Pool

	Fichas        domain.FichaRepository
	Treinos       domain.TreinoRepository
	Itens         domain.ItemTreinoRepository
	FichaCompleta domain.FichaCompletaRepository
	TreinoHoje    domain.TreinoHojeRepository
	AlunoLookup   application.AlunoLookup
}

// NewPostgresRepositories cria a instância com o pool compartilhado e expõe
// os repositórios prontos para uso.
func NewPostgresRepositories(pool *pgxpool.Pool) *PostgresRepositories {
	return &PostgresRepositories{
		pool:          pool,
		Fichas:        &fichaRepo{pool: pool},
		Treinos:       &treinoRepo{pool: pool},
		Itens:         &itemTreinoRepo{pool: pool},
		FichaCompleta: &fichaCompletaRepo{pool: pool},
		TreinoHoje:    &treinoHojeRepo{pool: pool},
		AlunoLookup:   &alunoLookup{pool: pool},
	}
}

// ── Ficha ──────────────────────────────────────────────────────────────────

type fichaRepo struct {
	pool *pgxpool.Pool
}

func (r *fichaRepo) Create(ctx context.Context, f *domain.FichaTreino) error {
	const q = `
		INSERT INTO ficha_treino (
			id, aluno_id, personal_id, nome, vigencia_inicio, vigencia_fim, ativa
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING criado_em, atualizado_em`

	err := r.pool.QueryRow(ctx, q,
		f.ID, f.AlunoID, f.PersonalID, f.Nome, f.VigenciaInicio, f.VigenciaFim, f.Ativa,
	).Scan(&f.CriadoEm, &f.AtualizadoEm)
	if err != nil {
		return fmt.Errorf("infrastructure: insert ficha: %w", err)
	}
	return nil
}

func (r *fichaRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.FichaTreino, error) {
	const q = `
		SELECT id, aluno_id, personal_id, nome,
		       vigencia_inicio, vigencia_fim, ativa, criado_em, atualizado_em
		FROM ficha_treino
		WHERE id = $1`

	var f domain.FichaTreino
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&f.ID, &f.AlunoID, &f.PersonalID, &f.Nome,
		&f.VigenciaInicio, &f.VigenciaFim, &f.Ativa, &f.CriadoEm, &f.AtualizadoEm,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrFichaNotFound
		}
		return nil, fmt.Errorf("infrastructure: find ficha: %w", err)
	}
	return &f, nil
}

func (r *fichaRepo) List(
	ctx context.Context,
	filter domain.ListFichasFilter,
) ([]*domain.FichaTreino, error) {
	// Os filtros opcionais (aluno_id, ativa) são tratados com NULL-coalesce
	// em uma única consulta para preservar o uso do índice composto sem
	// montagem dinâmica de SQL.
	const q = `
		SELECT id, aluno_id, personal_id, nome,
		       vigencia_inicio, vigencia_fim, ativa, criado_em, atualizado_em
		FROM ficha_treino
		WHERE personal_id = $1
		  AND ($2::uuid IS NULL OR aluno_id = $2)
		  AND ($3::boolean IS NULL OR ativa = $3)
		ORDER BY criado_em DESC`

	rows, err := r.pool.Query(ctx, q, filter.PersonalID, filter.AlunoID, filter.Ativa)
	if err != nil {
		return nil, fmt.Errorf("infrastructure: list fichas: %w", err)
	}
	defer rows.Close()

	out := make([]*domain.FichaTreino, 0)
	for rows.Next() {
		var f domain.FichaTreino
		if err := rows.Scan(
			&f.ID, &f.AlunoID, &f.PersonalID, &f.Nome,
			&f.VigenciaInicio, &f.VigenciaFim, &f.Ativa, &f.CriadoEm, &f.AtualizadoEm,
		); err != nil {
			return nil, fmt.Errorf("infrastructure: scan ficha: %w", err)
		}
		out = append(out, &f)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("infrastructure: iterate fichas: %w", err)
	}
	return out, nil
}

func (r *fichaRepo) FindAtivaByAluno(ctx context.Context, alunoID uuid.UUID) (*domain.FichaTreino, error) {
	const q = `
		SELECT id, aluno_id, personal_id, nome,
		       vigencia_inicio, vigencia_fim, ativa, criado_em, atualizado_em
		FROM ficha_treino
		WHERE aluno_id = $1
		  AND ativa = TRUE
		  AND vigencia_inicio <= CURRENT_DATE
		  AND (vigencia_fim IS NULL OR vigencia_fim >= CURRENT_DATE)
		ORDER BY criado_em DESC
		LIMIT 1`

	var f domain.FichaTreino
	err := r.pool.QueryRow(ctx, q, alunoID).Scan(
		&f.ID, &f.AlunoID, &f.PersonalID, &f.Nome,
		&f.VigenciaInicio, &f.VigenciaFim, &f.Ativa, &f.CriadoEm, &f.AtualizadoEm,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrSemFichaAtiva
		}
		return nil, fmt.Errorf("infrastructure: find ficha ativa: %w", err)
	}
	return &f, nil
}

func (r *fichaRepo) Update(ctx context.Context, f *domain.FichaTreino) error {
	const q = `
		UPDATE ficha_treino
		   SET nome = $2,
		       vigencia_inicio = $3,
		       vigencia_fim = $4,
		       ativa = $5,
		       atualizado_em = NOW()
		 WHERE id = $1`

	tag, err := r.pool.Exec(ctx, q, f.ID, f.Nome, f.VigenciaInicio, f.VigenciaFim, f.Ativa)
	if err != nil {
		return fmt.Errorf("infrastructure: update ficha: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrFichaNotFound
	}
	return nil
}

func (r *fichaRepo) Deactivate(ctx context.Context, id uuid.UUID) error {
	const q = `
		UPDATE ficha_treino
		   SET ativa = FALSE, atualizado_em = NOW()
		 WHERE id = $1`

	tag, err := r.pool.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("infrastructure: deactivate ficha: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrFichaNotFound
	}
	return nil
}

// ── Treino ─────────────────────────────────────────────────────────────────

type treinoRepo struct {
	pool *pgxpool.Pool
}

func (r *treinoRepo) Create(ctx context.Context, t *domain.Treino) error {
	const q = `
		INSERT INTO treino (id, ficha_id, letra, nome, ordem)
		VALUES ($1, $2, $3, NULLIF($4, ''), $5)`

	if _, err := r.pool.Exec(ctx, q, t.ID, t.FichaID, t.Letra, t.Nome, t.Ordem); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
			return domain.ErrLetraJaUsada
		}
		return fmt.Errorf("infrastructure: insert treino: %w", err)
	}
	return nil
}

func (r *treinoRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.Treino, error) {
	const q = `
		SELECT id, ficha_id, letra, COALESCE(nome, ''), ordem
		FROM treino
		WHERE id = $1`

	var t domain.Treino
	err := r.pool.QueryRow(ctx, q, id).Scan(&t.ID, &t.FichaID, &t.Letra, &t.Nome, &t.Ordem)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrTreinoNotFound
		}
		return nil, fmt.Errorf("infrastructure: find treino: %w", err)
	}
	return &t, nil
}

func (r *treinoRepo) ListByFicha(ctx context.Context, fichaID uuid.UUID) ([]*domain.Treino, error) {
	const q = `
		SELECT id, ficha_id, letra, COALESCE(nome, ''), ordem
		FROM treino
		WHERE ficha_id = $1
		ORDER BY ordem ASC, letra ASC`

	rows, err := r.pool.Query(ctx, q, fichaID)
	if err != nil {
		return nil, fmt.Errorf("infrastructure: list treinos: %w", err)
	}
	defer rows.Close()

	out := make([]*domain.Treino, 0)
	for rows.Next() {
		var t domain.Treino
		if err := rows.Scan(&t.ID, &t.FichaID, &t.Letra, &t.Nome, &t.Ordem); err != nil {
			return nil, fmt.Errorf("infrastructure: scan treino: %w", err)
		}
		out = append(out, &t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("infrastructure: iterate treinos: %w", err)
	}
	return out, nil
}

func (r *treinoRepo) Update(ctx context.Context, t *domain.Treino) error {
	const q = `
		UPDATE treino
		   SET letra = $2,
		       nome = NULLIF($3, ''),
		       ordem = $4
		 WHERE id = $1`

	tag, err := r.pool.Exec(ctx, q, t.ID, t.Letra, t.Nome, t.Ordem)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
			return domain.ErrLetraJaUsada
		}
		return fmt.Errorf("infrastructure: update treino: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrTreinoNotFound
	}
	return nil
}

func (r *treinoRepo) Delete(ctx context.Context, id uuid.UUID) error {
	const q = `DELETE FROM treino WHERE id = $1`

	tag, err := r.pool.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("infrastructure: delete treino: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrTreinoNotFound
	}
	return nil
}

// ── ItemTreino ─────────────────────────────────────────────────────────────

type itemTreinoRepo struct {
	pool *pgxpool.Pool
}

func (r *itemTreinoRepo) Create(ctx context.Context, i *domain.ItemTreino) error {
	const q = `
		INSERT INTO item_treino (
			id, treino_id, exercicio_id, ordem,
			series, repeticoes, carga_sugerida, descanso_segundos, observacao
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, ''))`

	if _, err := r.pool.Exec(ctx, q,
		i.ID, i.TreinoID, i.ExercicioID, i.Ordem,
		i.Series, i.Repeticoes, i.CargaSugerida, i.DescansoSegundos, i.Observacao,
	); err != nil {
		return fmt.Errorf("infrastructure: insert item: %w", err)
	}
	return nil
}

func (r *itemTreinoRepo) FindByID(ctx context.Context, id uuid.UUID) (*domain.ItemTreino, error) {
	const q = `
		SELECT id, treino_id, exercicio_id, ordem,
		       series, repeticoes, carga_sugerida, descanso_segundos,
		       COALESCE(observacao, '')
		FROM item_treino
		WHERE id = $1`

	var i domain.ItemTreino
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&i.ID, &i.TreinoID, &i.ExercicioID, &i.Ordem,
		&i.Series, &i.Repeticoes, &i.CargaSugerida, &i.DescansoSegundos, &i.Observacao,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrItemTreinoNotFound
		}
		return nil, fmt.Errorf("infrastructure: find item: %w", err)
	}
	return &i, nil
}

func (r *itemTreinoRepo) ListByTreino(ctx context.Context, treinoID uuid.UUID) ([]*domain.ItemTreino, error) {
	const q = `
		SELECT id, treino_id, exercicio_id, ordem,
		       series, repeticoes, carga_sugerida, descanso_segundos,
		       COALESCE(observacao, '')
		FROM item_treino
		WHERE treino_id = $1
		ORDER BY ordem ASC`

	rows, err := r.pool.Query(ctx, q, treinoID)
	if err != nil {
		return nil, fmt.Errorf("infrastructure: list itens: %w", err)
	}
	defer rows.Close()

	out := make([]*domain.ItemTreino, 0)
	for rows.Next() {
		var i domain.ItemTreino
		if err := rows.Scan(
			&i.ID, &i.TreinoID, &i.ExercicioID, &i.Ordem,
			&i.Series, &i.Repeticoes, &i.CargaSugerida, &i.DescansoSegundos, &i.Observacao,
		); err != nil {
			return nil, fmt.Errorf("infrastructure: scan item: %w", err)
		}
		out = append(out, &i)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("infrastructure: iterate itens: %w", err)
	}
	return out, nil
}

func (r *itemTreinoRepo) Update(ctx context.Context, i *domain.ItemTreino) error {
	const q = `
		UPDATE item_treino
		   SET ordem = $2,
		       series = $3,
		       repeticoes = $4,
		       carga_sugerida = $5,
		       descanso_segundos = $6,
		       observacao = NULLIF($7, '')
		 WHERE id = $1`

	tag, err := r.pool.Exec(ctx, q,
		i.ID, i.Ordem, i.Series, i.Repeticoes,
		i.CargaSugerida, i.DescansoSegundos, i.Observacao,
	)
	if err != nil {
		return fmt.Errorf("infrastructure: update item: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrItemTreinoNotFound
	}
	return nil
}

func (r *itemTreinoRepo) Delete(ctx context.Context, id uuid.UUID) error {
	const q = `DELETE FROM item_treino WHERE id = $1`

	tag, err := r.pool.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("infrastructure: delete item: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrItemTreinoNotFound
	}
	return nil
}

// Reorder atualiza a coluna ordem dos itens em uma única transação.
//
// Estratégia: validar que TODOS os IDs informados pertencem ao treino antes
// de aplicar updates — evita estado parcial (alguns itens reordenados,
// outros não). Updates são feitos sob uma transação serializável.
func (r *itemTreinoRepo) Reorder(
	ctx context.Context,
	treinoID uuid.UUID,
	novosIDs []uuid.UUID,
) error {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
	if err != nil {
		return fmt.Errorf("infrastructure: begin tx reorder: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Conta quantos dos IDs informados realmente pertencem ao treino.
	const countQ = `
		SELECT COUNT(*)
		FROM item_treino
		WHERE treino_id = $1 AND id = ANY($2::uuid[])`

	var hits int
	if err := tx.QueryRow(ctx, countQ, treinoID, novosIDs).Scan(&hits); err != nil {
		return fmt.Errorf("infrastructure: count itens reorder: %w", err)
	}
	if hits != len(novosIDs) {
		return domain.ErrReorderInconsistente
	}

	// Aplica a nova ordem (índice no slice = ordem). Update por linha com
	// guard de treino_id para defender contra race entre validação e update.
	const updQ = `
		UPDATE item_treino
		   SET ordem = $1
		 WHERE id = $2 AND treino_id = $3`

	for ordem, id := range novosIDs {
		tag, err := tx.Exec(ctx, updQ, ordem, id, treinoID)
		if err != nil {
			return fmt.Errorf("infrastructure: update ordem item: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return domain.ErrReorderInconsistente
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("infrastructure: commit tx reorder: %w", err)
	}
	return nil
}

// ── FichaCompleta (read model) ────────────────────────────────────────────

type fichaCompletaRepo struct {
	pool *pgxpool.Pool
}

// GetCompleta carrega ficha + treinos + itens em 3 queries.
//
// Decisão: 3 queries em vez de 1 mega-JOIN porque (a) o JOIN agregando 3
// níveis com array_agg de JSON multiplica complexidade do mapeamento sem
// ganho real (pgxpool serializa execução no mesmo conn), e (b) cada query
// fica testável e indexada de forma simples (idx_item_treino_treino cobre
// a 3ª).
func (r *fichaCompletaRepo) GetCompleta(
	ctx context.Context,
	fichaID uuid.UUID,
) (*domain.FichaCompleta, error) {
	// 1) Ficha
	const fichaQ = `
		SELECT id, aluno_id, personal_id, nome,
		       vigencia_inicio, vigencia_fim, ativa, criado_em, atualizado_em
		FROM ficha_treino
		WHERE id = $1`

	var f domain.FichaTreino
	err := r.pool.QueryRow(ctx, fichaQ, fichaID).Scan(
		&f.ID, &f.AlunoID, &f.PersonalID, &f.Nome,
		&f.VigenciaInicio, &f.VigenciaFim, &f.Ativa, &f.CriadoEm, &f.AtualizadoEm,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrFichaNotFound
		}
		return nil, fmt.Errorf("infrastructure: get ficha completa: %w", err)
	}

	// 2) Treinos
	const treinosQ = `
		SELECT id, ficha_id, letra, COALESCE(nome, ''), ordem
		FROM treino
		WHERE ficha_id = $1
		ORDER BY ordem ASC, letra ASC`

	tRows, err := r.pool.Query(ctx, treinosQ, fichaID)
	if err != nil {
		return nil, fmt.Errorf("infrastructure: get treinos completa: %w", err)
	}
	defer tRows.Close()

	treinos := make([]domain.Treino, 0)
	treinoIDs := make([]uuid.UUID, 0)
	for tRows.Next() {
		var t domain.Treino
		if err := tRows.Scan(&t.ID, &t.FichaID, &t.Letra, &t.Nome, &t.Ordem); err != nil {
			return nil, fmt.Errorf("infrastructure: scan treino completa: %w", err)
		}
		treinos = append(treinos, t)
		treinoIDs = append(treinoIDs, t.ID)
	}
	if err := tRows.Err(); err != nil {
		return nil, fmt.Errorf("infrastructure: iterate treinos completa: %w", err)
	}

	// 3) Itens (com JOIN em exercicio + grupo_muscular).
	itensPorTreino := map[uuid.UUID][]domain.ItemTreinoComExercicio{}
	if len(treinoIDs) > 0 {
		const itensQ = `
			SELECT it.id, it.treino_id, it.exercicio_id, it.ordem,
			       it.series, it.repeticoes, it.carga_sugerida, it.descanso_segundos,
			       COALESCE(it.observacao, ''),
			       e.nome, COALESCE(e.descricao, ''),
			       COALESCE(e.midia_url, ''), COALESCE(e.tipo_midia::text, ''),
			       (e.personal_id IS NULL) AS is_global,
			       gm.id, gm.nome
			FROM item_treino it
			JOIN exercicio e ON e.id = it.exercicio_id
			JOIN grupo_muscular gm ON gm.id = e.grupo_muscular_id
			WHERE it.treino_id = ANY($1::uuid[])
			ORDER BY it.ordem ASC`

		iRows, err := r.pool.Query(ctx, itensQ, treinoIDs)
		if err != nil {
			return nil, fmt.Errorf("infrastructure: get itens completa: %w", err)
		}
		defer iRows.Close()

		for iRows.Next() {
			var it domain.ItemTreinoComExercicio
			if err := iRows.Scan(
				&it.ID, &it.TreinoID, &it.ExercicioID, &it.Ordem,
				&it.Series, &it.Repeticoes, &it.CargaSugerida, &it.DescansoSegundos,
				&it.Observacao,
				&it.ExercicioNome, &it.ExercicioDescricao,
				&it.ExercicioMidiaURL, &it.ExercicioTipoMidia,
				&it.ExercicioIsGlobal,
				&it.GrupoMuscularID, &it.GrupoMuscularNome,
			); err != nil {
				return nil, fmt.Errorf("infrastructure: scan item completa: %w", err)
			}
			itensPorTreino[it.TreinoID] = append(itensPorTreino[it.TreinoID], it)
		}
		if err := iRows.Err(); err != nil {
			return nil, fmt.Errorf("infrastructure: iterate itens completa: %w", err)
		}
	}

	completos := make([]domain.TreinoCompleto, 0, len(treinos))
	for _, t := range treinos {
		completos = append(completos, domain.TreinoCompleto{
			Treino: t,
			Itens:  itensPorTreino[t.ID],
		})
	}

	return &domain.FichaCompleta{Ficha: f, Treinos: completos}, nil
}

// ── TreinoHoje ─────────────────────────────────────────────────────────────

type treinoHojeRepo struct {
	pool *pgxpool.Pool
}

// GetTreinoHoje implementa a regra do "próximo treino da sequência":
//
//  1. Identifica a ficha ativa do aluno hoje (vigência válida).
//  2. Lista os treinos da ficha em ordem (`ordem ASC, letra ASC`).
//  3. Identifica a última sessão CONCLUÍDA para algum treino dessa ficha.
//  4. Se nunca houve sessão concluída → retorna o primeiro treino.
//     Se houve, retorna o próximo na sequência; se passou do último,
//     volta ao primeiro (rotação A→B→C→A).
//
// Estratégia: 1 query que descobre o ID do treino do dia + 1 query que
// carrega o treino completo (com itens). Dividir simplifica o mapeamento
// e mantém o índice idx_item_treino_treino na 2ª query.
func (r *treinoHojeRepo) GetTreinoHoje(
	ctx context.Context,
	alunoID uuid.UUID,
) (*domain.TreinoCompleto, error) {
	// Tipos de retorno do CTE: id do treino + flag de "ficha existe mas
	// sem treinos". Strings no SELECT facilitam o tratamento dos casos
	// de borda (ErrSemFichaAtiva vs ErrSemTreinoHoje).
	const sequenciaQ = `
		WITH ficha_ativa AS (
			SELECT id
			FROM ficha_treino
			WHERE aluno_id = $1
			  AND ativa = TRUE
			  AND vigencia_inicio <= CURRENT_DATE
			  AND (vigencia_fim IS NULL OR vigencia_fim >= CURRENT_DATE)
			ORDER BY criado_em DESC
			LIMIT 1
		),
		treinos_ordenados AS (
			SELECT t.id, t.ordem, t.letra,
			       ROW_NUMBER() OVER (ORDER BY t.ordem ASC, t.letra ASC) AS pos
			FROM treino t
			JOIN ficha_ativa f ON t.ficha_id = f.id
		),
		ultima_sessao AS (
			SELECT t.id AS treino_id
			FROM sessao_treino s
			JOIN treino t ON t.id = s.treino_id
			JOIN ficha_ativa f ON t.ficha_id = f.id
			WHERE s.aluno_id = $1
			  AND s.status = 'CONCLUIDO'
			ORDER BY s.data_execucao DESC, s.concluido_em DESC NULLS LAST
			LIMIT 1
		),
		proximo AS (
			SELECT t.id
			FROM treinos_ordenados t
			WHERE t.pos = (
				COALESCE(
					(
						SELECT to2.pos
						FROM treinos_ordenados to2
						WHERE to2.id = (SELECT treino_id FROM ultima_sessao)
					),
					0
				) % NULLIF((SELECT COUNT(*) FROM treinos_ordenados), 0)
			) + 1
			LIMIT 1
		)
		SELECT
			(SELECT id FROM ficha_ativa)        AS ficha_ativa_id,
			(SELECT COUNT(*) FROM treinos_ordenados)::int AS total_treinos,
			(SELECT id FROM proximo)            AS treino_id`

	var fichaAtivaID *uuid.UUID
	var totalTreinos int
	var treinoID *uuid.UUID

	err := r.pool.QueryRow(ctx, sequenciaQ, alunoID).Scan(&fichaAtivaID, &totalTreinos, &treinoID)
	if err != nil {
		return nil, fmt.Errorf("infrastructure: query treino hoje: %w", err)
	}
	if fichaAtivaID == nil {
		return nil, domain.ErrSemFichaAtiva
	}
	if totalTreinos == 0 || treinoID == nil {
		return nil, domain.ErrSemTreinoHoje
	}

	// 2ª query: carrega o treino + itens (com JOIN em exercicio/grupo).
	return r.loadTreinoCompleto(ctx, *treinoID)
}

func (r *treinoHojeRepo) loadTreinoCompleto(
	ctx context.Context,
	treinoID uuid.UUID,
) (*domain.TreinoCompleto, error) {
	const treinoQ = `
		SELECT id, ficha_id, letra, COALESCE(nome, ''), ordem
		FROM treino
		WHERE id = $1`

	var t domain.Treino
	err := r.pool.QueryRow(ctx, treinoQ, treinoID).Scan(
		&t.ID, &t.FichaID, &t.Letra, &t.Nome, &t.Ordem,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrTreinoNotFound
		}
		return nil, fmt.Errorf("infrastructure: load treino hoje: %w", err)
	}

	const itensQ = `
		SELECT it.id, it.treino_id, it.exercicio_id, it.ordem,
		       it.series, it.repeticoes, it.carga_sugerida, it.descanso_segundos,
		       COALESCE(it.observacao, ''),
		       e.nome, COALESCE(e.descricao, ''),
		       COALESCE(e.midia_url, ''), COALESCE(e.tipo_midia::text, ''),
		       (e.personal_id IS NULL) AS is_global,
		       gm.id, gm.nome
		FROM item_treino it
		JOIN exercicio e ON e.id = it.exercicio_id
		JOIN grupo_muscular gm ON gm.id = e.grupo_muscular_id
		WHERE it.treino_id = $1
		ORDER BY it.ordem ASC`

	rows, err := r.pool.Query(ctx, itensQ, treinoID)
	if err != nil {
		return nil, fmt.Errorf("infrastructure: load itens treino hoje: %w", err)
	}
	defer rows.Close()

	itens := make([]domain.ItemTreinoComExercicio, 0)
	for rows.Next() {
		var it domain.ItemTreinoComExercicio
		if err := rows.Scan(
			&it.ID, &it.TreinoID, &it.ExercicioID, &it.Ordem,
			&it.Series, &it.Repeticoes, &it.CargaSugerida, &it.DescansoSegundos,
			&it.Observacao,
			&it.ExercicioNome, &it.ExercicioDescricao,
			&it.ExercicioMidiaURL, &it.ExercicioTipoMidia,
			&it.ExercicioIsGlobal,
			&it.GrupoMuscularID, &it.GrupoMuscularNome,
		); err != nil {
			return nil, fmt.Errorf("infrastructure: scan item treino hoje: %w", err)
		}
		itens = append(itens, it)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("infrastructure: iterate itens treino hoje: %w", err)
	}

	return &domain.TreinoCompleto{Treino: t, Itens: itens}, nil
}

// ── AlunoLookup (cross-context) ────────────────────────────────────────────

// alunoLookup faz uma query direta na tabela aluno para verificar ownership.
//
// Decisão: optar por query direta em vez de chamar identity.AlunoRepository
// para manter os bounded contexts desacoplados. Training não conhece a
// estrutura interna do Identity; só assume um contrato simples e estável
// (a tabela aluno tem id e personal_id). Isso evita ciclos de import e
// permite que cada contexto evolua sua entidade Aluno separadamente.
type alunoLookup struct {
	pool *pgxpool.Pool
}

func (l *alunoLookup) BelongsToPersonal(
	ctx context.Context,
	alunoID, personalID uuid.UUID,
) (bool, error) {
	const q = `
		SELECT EXISTS (
			SELECT 1 FROM aluno
			WHERE id = $1 AND personal_id = $2 AND ativo = TRUE
		)`

	var ok bool
	if err := l.pool.QueryRow(ctx, q, alunoID, personalID).Scan(&ok); err != nil {
		return false, fmt.Errorf("infrastructure: aluno lookup: %w", err)
	}
	return ok, nil
}
