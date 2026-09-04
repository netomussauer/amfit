package infrastructure

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// expoPushEndpoint é a API REST do Expo Push Notification Service — o
// backend nunca fala diretamente com FCM/APNs (SDD §13.2). É um endpoint
// simples o bastante pra não justificar um SDK dedicado (go.mod não tinha
// nenhum antes desta entrega).
const expoPushEndpoint = "https://exp.host/--/api/v2/push/send"

// ExpoPushClient envia uma notificação por vez pra Expo Push API.
//
// Simplificação deliberada: a API do Expo aceita lotes (array de
// mensagens, até 100 por request) — não implementado aqui porque esta
// entrega não tem nenhum device Expo real registrado pra validar contra
// (ver decisão registrada no README/PR: "monta o mecanismo, sem validar
// entrega real agora"). Uma vez que haja tráfego de verdade, trocar pra
// batch é uma mudança isolada neste arquivo, sem tocar no worker.
type ExpoPushClient struct {
	httpClient *http.Client
}

// NewExpoPushClient cria o cliente com um timeout curto — o worker não
// pode travar indefinidamente numa chamada de rede externa.
func NewExpoPushClient() *ExpoPushClient {
	return &ExpoPushClient{
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

type expoPushMessage struct {
	To    string          `json:"to"`
	Title string          `json:"title"`
	Body  string          `json:"body"`
	Data  json.RawMessage `json:"data,omitempty"`
}

// expoPushTicket é o resultado por mensagem — a Expo Push API devolve HTTP
// 200 mesmo quando a entrega falhou (token inválido/desregistrado); o
// status real vem só aqui dentro. Ver
// https://docs.expo.dev/push-notifications/sending-notifications/#push-tickets.
type expoPushTicket struct {
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
	Details struct {
		Error string `json:"error,omitempty"`
	} `json:"details,omitempty"`
}

// expoPushResponse é o envelope da resposta — `data` vem como objeto único
// (não array) porque enviamos uma mensagem por request (ver comentário no
// tipo ExpoPushClient sobre não fazer batch nesta entrega).
type expoPushResponse struct {
	Data *expoPushTicket `json:"data,omitempty"`
}

// Send envia uma notificação push pro token informado. `to` é o token Expo
// (formato "ExponentPushToken[...]"); `data` é opcional (json cru, pode ser
// nil).
func (c *ExpoPushClient) Send(ctx context.Context, to, title, body string, data json.RawMessage) error {
	payload, err := json.Marshal(expoPushMessage{To: to, Title: title, Body: body, Data: data})
	if err != nil {
		return fmt.Errorf("expo push: marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, expoPushEndpoint, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("expo push: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("expo push: request failed: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if err != nil {
		return fmt.Errorf("expo push: read response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("expo push: status %d: %s", resp.StatusCode, string(raw))
	}

	var parsed expoPushResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return fmt.Errorf("expo push: parse response: %w", err)
	}
	if parsed.Data == nil {
		return fmt.Errorf("expo push: resposta sem ticket: %s", string(raw))
	}
	if parsed.Data.Status != "ok" {
		return fmt.Errorf("expo push: ticket com erro (%s): %s", parsed.Data.Details.Error, parsed.Data.Message)
	}
	return nil
}
