// Package infrastructure contém as implementações de repositório para o
// contexto Coach.
package infrastructure

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/amfit/api/internal/coach/application"
	"github.com/amfit/api/internal/coach/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// pgForeignKeyViolation é o SQLSTATE 23503 (foreign_key_violation) — usado
// pra traduzir um item_treino_id inexistente no erro de domínio correto em
// vez de propagar o erro cru do Postgres (ver comentário na migration
// 000011 sobre por que não há um lookup de posse separado).
const pgForeignKeyViolation = "23503"

func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgForeignKeyViolation
}

// pgUniqueViolation é o SQLSTATE 23505 (unique_violation) — usado pra
// traduzir uma corrida de concorrência (dois POST /coach/videos/{id}/feedback
// pro mesmo vídeo ao mesmo tempo, batendo na UNIQUE(video_id) da migration
// 000011) no 409 correto em vez de um 500 cru. Mesmo padrão de
// financial/infrastructure's pgUniqueViolation.
const pgUniqueViolation = "23505"

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation
}

// PostgresRepositories agrega os repositórios PostgreSQL do contexto Coach.
type PostgresRepositories struct {
	Videos      domain.CoachVideoRepository
	Feedbacks   domain.CoachVideoFeedbackRepository
	AlunoLookup application.AlunoLookup
}

// NewPostgresRepositories cria os repositórios sobre o pool compartilhado.
func NewPostgresRepositories(pool *pgxpool.Pool) *PostgresRepositories {
	return &PostgresRepositories{
		Videos:      &coachVideoRepo{pool: pool},
		Feedbacks:   &coachVideoFeedbackRepo{pool: pool},
		AlunoLookup: &alunoLookup{pool: pool},
	}
}

// ─── CoachVideo ──────────────────────────────────────────────────────────

type coachVideoRepo struct {
	pool *pgxpool.Pool
}

// coachVideoJoins são os LEFT JOINs (exercício via item_treino, feedback)
// que toda leitura de CoachVideo precisa além do JOIN com aluno — um só
// lugar pra não divergir entre coachVideoSelectBase e a listagem paginada
// (ver list()). SEMPRE usado antes de um WHERE — colar um JOIN depois do
// WHERE é erro de sintaxe no Postgres.
const coachVideoJoins = `
	LEFT JOIN item_treino it ON it.id = cv.item_treino_id
	LEFT JOIN exercicio e ON e.id = it.exercicio_id
	LEFT JOIN coach_video_feedback f ON f.video_id = cv.id`

const coachVideoSelectBase = `
	SELECT
		cv.id, cv.aluno_id, cv.personal_id, cv.item_treino_id, cv.video_object_key,
		cv.duracao_segundos, cv.status, COALESCE(cv.descricao, ''), cv.criado_em, cv.atualizado_em,
		a.nome, e.nome,
		f.id, f.texto, f.enviado_em
	FROM coach_video cv
	JOIN aluno a ON a.id = cv.aluno_id` + coachVideoJoins

type rowScanner interface {
	Scan(dest ...any) error
}

func scanCoachVideoComFeedback(row rowScanner) (*domain.CoachVideoComFeedback, error) {
	var v domain.CoachVideoComFeedback
	var status string
	var exercicioNome *string
	var feedbackID *uuid.UUID
	var feedbackTexto *string
	var feedbackEnviadoEm *time.Time

	if err := row.Scan(
		&v.ID, &v.AlunoID, &v.PersonalID, &v.ItemTreinoID, &v.VideoObjectKey,
		&v.DuracaoSegundos, &status, &v.Descricao, &v.CriadoEm, &v.AtualizadoEm,
		&v.AlunoNome, &exercicioNome,
		&feedbackID, &feedbackTexto, &feedbackEnviadoEm,
	); err != nil {
		return nil, err
	}
	v.Status = domain.StatusCoachVideo(status)
	v.ExercicioNome = exercicioNome

	if feedbackID != nil {
		v.Feedback = &domain.CoachVideoFeedback{
			ID:      *feedbackID,
			VideoID: v.ID,
		}
		if feedbackTexto != nil {
			v.Feedback.Texto = *feedbackTexto
		}
		if feedbackEnviadoEm != nil {
			v.Feedback.EnviadoEm = *feedbackEnviadoEm
		}
	}
	return &v, nil
}

func (r *coachVideoRepo) Create(ctx context.Context, v *domain.CoachVideo) error {
	const q = `
		INSERT INTO coach_video
			(id, aluno_id, personal_id, item_treino_id, video_object_key,
			 duracao_segundos, status, descricao)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''))
		RETURNING criado_em, atualizado_em`

	err := r.pool.QueryRow(ctx, q,
		v.ID, v.AlunoID, v.PersonalID, v.ItemTreinoID, v.VideoObjectKey,
		v.DuracaoSegundos, string(v.Status), v.Descricao,
	).Scan(&v.CriadoEm, &v.AtualizadoEm)
	if err != nil {
		if isForeignKeyViolation(err) {
			return domain.ErrItemTreinoInvalido
		}
		return fmt.Errorf("infrastructure: criar coach_video: %w", err)
	}
	return nil
}

func (r *coachVideoRepo) FindComFeedback(ctx context.Context, id uuid.UUID) (*domain.CoachVideoComFeedback, error) {
	q := coachVideoSelectBase + ` WHERE cv.id = $1`

	v, err := scanCoachVideoComFeedback(r.pool.QueryRow(ctx, q, id))
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("infrastructure: buscar coach_video: %w", err)
	}
	return v, nil
}

func (r *coachVideoRepo) ListByPersonal(
	ctx context.Context,
	personalID uuid.UUID,
	status *domain.StatusCoachVideo,
	page, perPage int,
) ([]*domain.CoachVideoComFeedback, int, error) {
	var statusArg *string
	if status != nil {
		s := string(*status)
		statusArg = &s
	}
	return r.list(ctx,
		`FROM coach_video cv
		 JOIN aluno a ON a.id = cv.aluno_id`+coachVideoJoins+`
		 WHERE cv.personal_id = $1
		   AND ($2::status_coach_video IS NULL OR cv.status = $2)`,
		[]any{personalID, statusArg},
		page, perPage,
	)
}

func (r *coachVideoRepo) ListByAluno(
	ctx context.Context,
	alunoID uuid.UUID,
	page, perPage int,
) ([]*domain.CoachVideoComFeedback, int, error) {
	return r.list(ctx,
		`FROM coach_video cv
		 JOIN aluno a ON a.id = cv.aluno_id`+coachVideoJoins+`
		 WHERE cv.aluno_id = $1`,
		[]any{alunoID},
		page, perPage,
	)
}

// list monta e executa a query paginada compartilhada por ListByPersonal e
// ListByAluno — cada caller monta seu próprio FROM/JOINs/WHERE completo
// (placeholders já preenchidos em args); list só acrescenta as colunas do
// SELECT, COUNT(*), ORDER BY e paginação.
func (r *coachVideoRepo) list(
	ctx context.Context,
	fromWhere string,
	args []any,
	page, perPage int,
) ([]*domain.CoachVideoComFeedback, int, error) {
	countQ := "SELECT COUNT(*) " + fromWhere
	var total int
	if err := r.pool.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("infrastructure: contar coach_video: %w", err)
	}

	limitPos := len(args) + 1
	offsetPos := len(args) + 2
	q := fmt.Sprintf(`
		SELECT
			cv.id, cv.aluno_id, cv.personal_id, cv.item_treino_id, cv.video_object_key,
			cv.duracao_segundos, cv.status, COALESCE(cv.descricao, ''), cv.criado_em, cv.atualizado_em,
			a.nome, e.nome,
			f.id, f.texto, f.enviado_em
		%s
		ORDER BY cv.criado_em DESC
		LIMIT $%d OFFSET $%d`, fromWhere, limitPos, offsetPos)

	offset := (page - 1) * perPage
	rows, err := r.pool.Query(ctx, q, append(append([]any{}, args...), perPage, offset)...)
	if err != nil {
		return nil, 0, fmt.Errorf("infrastructure: listar coach_video: %w", err)
	}
	defer rows.Close()

	out := make([]*domain.CoachVideoComFeedback, 0)
	for rows.Next() {
		v, err := scanCoachVideoComFeedback(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("infrastructure: scan coach_video: %w", err)
		}
		out = append(out, v)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("infrastructure: iterar coach_video: %w", err)
	}
	return out, total, nil
}

func (r *coachVideoRepo) MarcarFeedbackEnviado(ctx context.Context, videoID uuid.UUID) error {
	const q = `
		UPDATE coach_video
		   SET status = 'FEEDBACK_ENVIADO', atualizado_em = NOW()
		 WHERE id = $1`

	if _, err := r.pool.Exec(ctx, q, videoID); err != nil {
		return fmt.Errorf("infrastructure: marcar feedback enviado: %w", err)
	}
	return nil
}

// ─── CoachVideoFeedback ─────────────────────────────────────────────────

type coachVideoFeedbackRepo struct {
	pool *pgxpool.Pool
}

func (r *coachVideoFeedbackRepo) Create(ctx context.Context, f *domain.CoachVideoFeedback) error {
	const q = `
		INSERT INTO coach_video_feedback (id, video_id, personal_id, texto)
		VALUES ($1, $2, $3, $4)
		RETURNING enviado_em`

	if err := r.pool.QueryRow(ctx, q, f.ID, f.VideoID, f.PersonalID, f.Texto).Scan(&f.EnviadoEm); err != nil {
		if isUniqueViolation(err) {
			return domain.ErrCoachVideoJaTemFeedback
		}
		return fmt.Errorf("infrastructure: criar coach_video_feedback: %w", err)
	}
	return nil
}

// ─── AlunoLookup ─────────────────────────────────────────────────────────

type alunoLookup struct {
	pool *pgxpool.Pool
}

func (l *alunoLookup) BelongsToPersonal(ctx context.Context, alunoID, personalID uuid.UUID) (bool, error) {
	const q = `SELECT EXISTS (SELECT 1 FROM aluno WHERE id = $1 AND personal_id = $2)`

	var ok bool
	if err := l.pool.QueryRow(ctx, q, alunoID, personalID).Scan(&ok); err != nil {
		return false, fmt.Errorf("infrastructure: aluno lookup: %w", err)
	}
	return ok, nil
}

func (l *alunoLookup) PersonalIDENome(ctx context.Context, alunoID uuid.UUID) (uuid.UUID, string, error) {
	const q = `SELECT personal_id, nome FROM aluno WHERE id = $1`

	var personalID uuid.UUID
	var nome string
	if err := l.pool.QueryRow(ctx, q, alunoID).Scan(&personalID, &nome); err != nil {
		return uuid.Nil, "", fmt.Errorf("infrastructure: personal id e nome do aluno: %w", err)
	}
	return personalID, nome, nil
}
