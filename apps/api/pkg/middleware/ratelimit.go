package middleware

import (
	"sync"
	"time"

	"github.com/gofiber/fiber/v3"
)

// pruneThreshold é o tamanho do mapa a partir do qual entradas expiradas são
// removidas — evita crescimento sem limite com muitos IPs distintos.
const pruneThreshold = 10_000

type windowEntry struct {
	count   int
	resetAt time.Time
}

// fixedWindowLimiter conta requisições por chave numa janela fixa. Vive na
// memória do processo: não compartilha estado entre réplicas (com N réplicas
// o limite efetivo é N×max). A chave é o IP visto pela API — atrás de um
// proxy/LoadBalancer sem preservação de IP de origem, todos os clientes
// compartilham o mesmo contador (por isso os limites das rotas que o usam
// são generosos).
type fixedWindowLimiter struct {
	mu        sync.Mutex
	max       int
	window    time.Duration
	entries   map[string]*windowEntry
	nextPrune time.Time
	now       func() time.Time
}

func newFixedWindowLimiter(max int, window time.Duration) *fixedWindowLimiter {
	return &fixedWindowLimiter{
		max:     max,
		window:  window,
		entries: make(map[string]*windowEntry),
		now:     time.Now,
	}
}

// allow registra uma requisição da chave e informa se ainda está dentro do
// limite da janela atual.
func (l *fixedWindowLimiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	// Limpeza amortizada: no máximo uma varredura por janela, para que um
	// mapa grande (muitos IPs vivos) não custe O(n) em toda requisição.
	if len(l.entries) >= pruneThreshold && !now.Before(l.nextPrune) {
		for k, e := range l.entries {
			if !now.Before(e.resetAt) {
				delete(l.entries, k)
			}
		}
		l.nextPrune = now.Add(l.window)
	}

	e, ok := l.entries[key]
	if !ok || !now.Before(e.resetAt) {
		l.entries[key] = &windowEntry{count: 1, resetAt: now.Add(l.window)}
		return true
	}
	e.count++
	return e.count <= l.max
}

// RateLimitByIP limita a `max` requisições por IP a cada `window`; passado o
// limite, delega a resposta a limitReached (tipicamente um 429 em formato
// Problem Details). Use em rotas públicas sensíveis a enumeração.
func RateLimitByIP(max int, window time.Duration, limitReached fiber.Handler) fiber.Handler {
	l := newFixedWindowLimiter(max, window)
	return func(c fiber.Ctx) error {
		if !l.allow(c.IP()) {
			return limitReached(c)
		}
		return c.Next()
	}
}
