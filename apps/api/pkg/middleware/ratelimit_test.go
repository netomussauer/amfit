package middleware

import (
	"testing"
	"time"
)

func TestFixedWindowLimiter_BloqueiaAposOMaximo(t *testing.T) {
	l := newFixedWindowLimiter(3, time.Minute)
	agora := time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC)
	l.now = func() time.Time { return agora }

	for i := 1; i <= 3; i++ {
		if !l.allow("1.2.3.4") {
			t.Fatalf("requisicao %d deveria passar", i)
		}
	}
	if l.allow("1.2.3.4") {
		t.Fatal("a 4a requisicao da janela deveria ser bloqueada")
	}
}

func TestFixedWindowLimiter_ChavesIndependentes(t *testing.T) {
	l := newFixedWindowLimiter(1, time.Minute)
	l.now = func() time.Time { return time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC) }

	if !l.allow("a") {
		t.Fatal("primeira requisicao de 'a' deveria passar")
	}
	if l.allow("a") {
		t.Fatal("segunda requisicao de 'a' deveria ser bloqueada")
	}
	if !l.allow("b") {
		t.Fatal("'b' tem contador proprio e deveria passar")
	}
}

func TestFixedWindowLimiter_LiberaAposAJanela(t *testing.T) {
	l := newFixedWindowLimiter(1, time.Minute)
	agora := time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC)
	l.now = func() time.Time { return agora }

	l.allow("ip")
	if l.allow("ip") {
		t.Fatal("deveria estar bloqueado dentro da janela")
	}

	agora = agora.Add(time.Minute) // janela expirou
	if !l.allow("ip") {
		t.Fatal("deveria liberar quando a janela expira")
	}
}

func TestFixedWindowLimiter_LimpaEntradasExpiradasQuandoCresce(t *testing.T) {
	l := newFixedWindowLimiter(5, time.Minute)
	agora := time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC)
	l.now = func() time.Time { return agora }

	for i := 0; i < pruneThreshold; i++ {
		l.entries[string(rune('a'+i%26))+time.Duration(i).String()] = &windowEntry{count: 1, resetAt: agora.Add(-time.Second)}
	}

	agora = agora.Add(time.Second)
	l.allow("novo")

	if len(l.entries) > 2 {
		t.Errorf("entradas expiradas deveriam ter sido removidas, restaram %d", len(l.entries))
	}
}

func TestFixedWindowLimiter_LimpezaEhAmortizada(t *testing.T) {
	l := newFixedWindowLimiter(5, time.Minute)
	agora := time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC)
	l.now = func() time.Time { return agora }

	// Mapa grande com entradas ainda VIVAS: a varredura nao remove nada.
	for i := 0; i < pruneThreshold; i++ {
		l.entries[time.Duration(i).String()] = &windowEntry{count: 1, resetAt: agora.Add(time.Hour)}
	}
	l.allow("a") // primeira varredura (nextPrune zerado) — agenda a proxima
	proxima := l.nextPrune
	if !proxima.After(agora) {
		t.Fatalf("a proxima limpeza deveria ficar agendada para depois de agora, got %v", proxima)
	}

	l.allow("b") // dentro da janela: nao pode varrer de novo
	if !l.nextPrune.Equal(proxima) {
		t.Errorf("nao deveria varrer de novo dentro da janela (nextPrune mudou de %v para %v)", proxima, l.nextPrune)
	}
}
