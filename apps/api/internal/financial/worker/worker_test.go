package worker

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

type fakeJobs struct {
	gerarCalls    int32
	atrasarCalls  int32
	lembreteCalls int32
	lembreteLimit int32

	gerarErr    error
	atrasarErr  error
	lembreteErr error
}

func (f *fakeJobs) GerarMensalidadesDoMes(ctx context.Context) (int, error) {
	atomic.AddInt32(&f.gerarCalls, 1)
	return 0, f.gerarErr
}

func (f *fakeJobs) MarcarMensalidadesAtrasadas(ctx context.Context) (int, error) {
	atomic.AddInt32(&f.atrasarCalls, 1)
	return 0, f.atrasarErr
}

func (f *fakeJobs) EnviarLembretesVencimento(ctx context.Context, limit int) (int, error) {
	atomic.AddInt32(&f.lembreteCalls, 1)
	atomic.StoreInt32(&f.lembreteLimit, int32(limit))
	return 0, f.lembreteErr
}

func TestWorker_Run_ChamaOsTresJobsACadaTick(t *testing.T) {
	jobs := &fakeJobs{}
	w := NewWorker(jobs, 5*time.Millisecond)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		w.Run(ctx)
		close(done)
	}()

	deadline := time.After(500 * time.Millisecond)
	for {
		if atomic.LoadInt32(&jobs.gerarCalls) > 0 &&
			atomic.LoadInt32(&jobs.atrasarCalls) > 0 &&
			atomic.LoadInt32(&jobs.lembreteCalls) > 0 {
			break
		}
		select {
		case <-deadline:
			t.Fatal("timeout esperando o worker chamar os três jobs")
		case <-time.After(5 * time.Millisecond):
		}
	}

	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("Run não retornou após o contexto ser cancelado")
	}

	if limit := atomic.LoadInt32(&jobs.lembreteLimit); limit != lembreteBatchSize {
		t.Errorf("esperado limit=%d, got %d", lembreteBatchSize, limit)
	}
}

func TestWorker_Run_ErroEmUmJobNaoImpedeOsDemais(t *testing.T) {
	jobs := &fakeJobs{gerarErr: errors.New("boom")}
	w := NewWorker(jobs, 5*time.Millisecond)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go w.Run(ctx)

	deadline := time.After(500 * time.Millisecond)
	for {
		if atomic.LoadInt32(&jobs.atrasarCalls) > 0 && atomic.LoadInt32(&jobs.lembreteCalls) > 0 {
			return
		}
		select {
		case <-deadline:
			t.Fatal("timeout esperando os jobs seguintes rodarem apesar do erro no primeiro")
		case <-time.After(5 * time.Millisecond):
		}
	}
}
