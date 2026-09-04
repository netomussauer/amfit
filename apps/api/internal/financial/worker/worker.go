// Package worker contém o Financial Worker — job em background que
// substitui o pg_cron do SDD (ver comentário na migration 000010) por uma
// goroutine com polling periódico, no mesmo padrão do Notification
// Dispatcher (internal/notification/worker).
package worker

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"
)

// lembreteBatchSize limita quantas mensalidades entram na janela de
// lembrete por ciclo — mesma lógica de proteção contra picos usada no
// Notification Dispatcher (batchSize).
const lembreteBatchSize = 100

// Jobs abstrai os casos de uso do FinancialService consumidos pelo worker —
// port local (não domain.*Repository) porque o worker orquestra casos de
// uso completos, não acessa repositórios diretamente.
type Jobs interface {
	GerarMensalidadesDoMes(ctx context.Context) (int, error)
	MarcarMensalidadesAtrasadas(ctx context.Context) (int, error)
	EnviarLembretesVencimento(ctx context.Context, limit int) (int, error)
}

// Worker roda os três jobs de cobrança a cada `interval`: gerar
// mensalidades da competência corrente, marcar vencidas como atrasadas e
// disparar lembretes de vencimento.
type Worker struct {
	jobs     Jobs
	interval time.Duration
}

// NewWorker monta o worker com as dependências necessárias.
func NewWorker(jobs Jobs, interval time.Duration) *Worker {
	return &Worker{jobs: jobs, interval: interval}
}

// Run bloqueia até ctx ser cancelado — chamar como goroutine
// (`go worker.Run(ctx)`), com ctx atrelado ao shutdown gracioso do processo.
func (w *Worker) Run(ctx context.Context) {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.tick(ctx)
		}
	}
}

// tick roda os três jobs em sequência. Um erro em um job não impede os
// demais de rodar no mesmo ciclo — cada um é independente.
func (w *Worker) tick(ctx context.Context) {
	if n, err := w.jobs.GerarMensalidadesDoMes(ctx); err != nil {
		log.Error().Err(err).Msg("financial worker: gerar mensalidades do mes")
	} else if n > 0 {
		log.Info().Int("geradas", n).Msg("financial worker: mensalidades geradas")
	}

	if n, err := w.jobs.MarcarMensalidadesAtrasadas(ctx); err != nil {
		log.Error().Err(err).Msg("financial worker: marcar mensalidades atrasadas")
	} else if n > 0 {
		log.Info().Int("atrasadas", n).Msg("financial worker: mensalidades marcadas como atrasadas")
	}

	if n, err := w.jobs.EnviarLembretesVencimento(ctx, lembreteBatchSize); err != nil {
		log.Error().Err(err).Msg("financial worker: enviar lembretes de vencimento")
	} else if n > 0 {
		log.Info().Int("lembretes", n).Msg("financial worker: lembretes de vencimento enviados")
	}
}
