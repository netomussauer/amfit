// Package worker contém o Notification Dispatcher — o primeiro background
// worker deste codebase (nenhum outro contexto tem um processo de longa
// duração hoje; todo o resto é request/response).
package worker

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/amfit/api/internal/notification/domain"
	"github.com/rs/zerolog/log"
)

// batchSize limita quantas notificações pendentes são processadas por
// ciclo — evita que um pico enfileirado prenda um único tick por tempo
// demais (o próximo tick pega o resto).
const batchSize = 100

// maxDespachosConcorrentes limita quantos despachos rodam em paralelo por
// ciclo. Sem isso, um lote cheio (batchSize) despachado em série contra um
// ExpoSender com timeout de 10s (ver infrastructure/expo_client.go) pode
// levar minutos num único tick — o próximo tick só começa depois que o
// atual termina (ver Run), então a fila cresceria sem limite sob carga ou
// com a Expo lenta/degradada.
const maxDespachosConcorrentes = 10

// ExpoSender abstrai o envio real pra Expo Push API — port local ao worker
// (não domain.PushTokenRepository) porque é uma dependência de infra
// externa, não de persistência.
type ExpoSender interface {
	Send(ctx context.Context, to, title, body string, data json.RawMessage) error
}

// Dispatcher faz polling na tabela notificacao a cada `interval` e despacha
// as pendentes via ExpoSender (SDD §13.2 — "worker é uma goroutine de
// background iniciada junto com a API").
type Dispatcher struct {
	notifs   domain.NotificacaoRepository
	tokens   domain.PushTokenRepository
	expo     ExpoSender
	interval time.Duration
}

// NewDispatcher monta o dispatcher com as dependências necessárias.
func NewDispatcher(
	notifs domain.NotificacaoRepository,
	tokens domain.PushTokenRepository,
	expo ExpoSender,
	interval time.Duration,
) *Dispatcher {
	return &Dispatcher{notifs: notifs, tokens: tokens, expo: expo, interval: interval}
}

// Run bloqueia até ctx ser cancelado — chamar como goroutine
// (`go dispatcher.Run(ctx)`), com ctx atrelado ao shutdown gracioso do
// processo.
func (d *Dispatcher) Run(ctx context.Context) {
	ticker := time.NewTicker(d.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			d.processarPendentes(ctx)
		}
	}
}

// processarPendentes despacha até batchSize notificações pendentes. Erros
// por notificação individual (ex: token inválido, Expo fora do ar) não
// interrompem o processamento das demais — só ficam registrados como ERRO
// pra investigação, sem travar a fila inteira.
func (d *Dispatcher) processarPendentes(ctx context.Context) {
	pendentes, err := d.notifs.ListarPendentes(ctx, batchSize)
	if err != nil {
		log.Error().Err(err).Msg("notification dispatcher: listar pendentes")
		return
	}

	sem := make(chan struct{}, maxDespachosConcorrentes)
	var wg sync.WaitGroup
	for _, n := range pendentes {
		n := n
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-sem }()
			d.despachar(ctx, n)
		}()
	}
	wg.Wait()
}

func (d *Dispatcher) despachar(ctx context.Context, n domain.Notificacao) {
	tokens, err := d.tokens.ListaAtivosPorOwner(ctx, n.DestinatarioID, n.DestinatarioTipo)
	if err != nil {
		log.Error().Err(err).Str("notificacao_id", n.ID.String()).Msg("notification dispatcher: buscar tokens")
		if merr := d.notifs.MarcarErro(ctx, n.ID, err.Error()); merr != nil {
			log.Error().Err(merr).Str("notificacao_id", n.ID.String()).Msg("notification dispatcher: marcar erro")
		}
		return
	}

	if len(tokens) == 0 {
		// "notificação é silenciosa se não houver token" (SDD §13.2) — não
		// é uma falha, só não há pra onde despachar. Marca ENVIADA pra não
		// reprocessar essa notificação pra sempre.
		if err := d.notifs.MarcarEnviada(ctx, n.ID); err != nil {
			log.Error().Err(err).Str("notificacao_id", n.ID.String()).Msg("notification dispatcher: marcar enviada (sem token)")
		}
		return
	}

	var ultimoErro error
	for _, t := range tokens {
		if err := d.expo.Send(ctx, t.Token, n.Titulo, n.Corpo, n.DadosExtras); err != nil {
			ultimoErro = err
			log.Error().Err(err).
				Str("notificacao_id", n.ID.String()).
				Str("push_token_id", t.ID.String()).
				Msg("notification dispatcher: falha ao enviar via expo")
		}
	}

	if ultimoErro != nil {
		if err := d.notifs.MarcarErro(ctx, n.ID, ultimoErro.Error()); err != nil {
			log.Error().Err(err).Str("notificacao_id", n.ID.String()).Msg("notification dispatcher: marcar erro")
		}
		return
	}
	if err := d.notifs.MarcarEnviada(ctx, n.ID); err != nil {
		log.Error().Err(err).Str("notificacao_id", n.ID.String()).Msg("notification dispatcher: marcar enviada")
	}
}
