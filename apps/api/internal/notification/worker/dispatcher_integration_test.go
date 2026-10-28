//go:build integration

package worker

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/amfit/api/internal/notification/domain"
	"github.com/amfit/api/internal/notification/infrastructure"
	"github.com/amfit/api/internal/testsupport/pgtest"
	"github.com/google/uuid"
)

type expoContador struct {
	mu     sync.Mutex
	envios map[string]int // titulo -> vezes enviado
	atraso time.Duration
}

func (e *expoContador) Send(_ context.Context, _, title, _ string, _ json.RawMessage) error {
	time.Sleep(e.atraso)
	e.mu.Lock()
	defer e.mu.Unlock()
	e.envios[title]++
	return nil
}

// Duas "replicas" da API rodando o ciclo ao mesmo tempo sobre a mesma fila:
// cada notificacao tem de sair exatamente uma vez.
func TestDispatcher_DuasReplicas_NaoDuplicamEnvio(t *testing.T) {
	pool := pgtest.NewDB(t)
	seed := pgtest.NewSeed(t, pool)
	repos := infrastructure.NewPostgresRepositories(pool)

	aluno := seed.Aluno(seed.Personal())
	if err := repos.Tokens.Upsert(seed.Ctx, &domain.PushToken{
		ID: uuid.New(), OwnerID: aluno, OwnerTipo: domain.OwnerAluno, Token: "ExponentPushToken[x]", Plataforma: domain.PlataformaIOS, Ativo: true,
	}); err != nil {
		t.Fatal(err)
	}
	const total = 20
	for i := 0; i < total; i++ {
		n := &domain.Notificacao{
			ID: uuid.New(), DestinatarioID: aluno, DestinatarioTipo: domain.OwnerAluno,
			Titulo: "n" + string(rune('A'+i)), Corpo: "c", Tipo: domain.TipoTreinoConcluido, Status: domain.StatusPendente,
		}
		if err := repos.Notifs.Criar(seed.Ctx, n); err != nil {
			t.Fatal(err)
		}
	}

	expo := &expoContador{envios: map[string]int{}, atraso: 20 * time.Millisecond}
	// Cada replica tem seu proprio dispatcher (e portanto sua propria conexao de lock).
	d1 := NewDispatcher(repos.Notifs, repos.Tokens, expo, 0)
	d2 := NewDispatcher(repos.Notifs, repos.Tokens, expo, 0)

	for rodada := 0; rodada < 3; rodada++ {
		var wg sync.WaitGroup
		for _, d := range []*Dispatcher{d1, d2} {
			wg.Add(1)
			go func(d *Dispatcher) { defer wg.Done(); d.processarPendentes(seed.Ctx) }(d)
		}
		wg.Wait()
	}

	if len(expo.envios) != total {
		t.Errorf("notificacoes enviadas = %d, quer %d", len(expo.envios), total)
	}
	for titulo, vezes := range expo.envios {
		if vezes != 1 {
			t.Errorf("%s enviada %d vezes", titulo, vezes)
		}
	}
	var pendentes int
	_ = pool.QueryRow(seed.Ctx, `SELECT COUNT(*) FROM notificacao WHERE status='PENDENTE'`).Scan(&pendentes)
	if pendentes != 0 {
		t.Errorf("pendentes restantes: %d", pendentes)
	}
}

func TestTentarLiderar_ExclusaoMutuaELiberacao(t *testing.T) {
	pool := pgtest.NewDB(t)
	repos := infrastructure.NewPostgresRepositories(pool)
	l := repos.Notifs.(Lider)
	ctx := context.Background()

	libera1, ok, err := l.TentarLiderar(ctx)
	if err != nil || !ok {
		t.Fatalf("primeiro: ok=%v err=%v", ok, err)
	}
	if _, ok, err := l.TentarLiderar(ctx); err != nil || ok {
		t.Fatalf("segundo concorrente deveria negar: ok=%v err=%v", ok, err)
	}
	libera1()
	libera2, ok, err := l.TentarLiderar(ctx)
	if err != nil || !ok {
		t.Fatalf("apos liberar: ok=%v err=%v", ok, err)
	}
	libera2()
}
