// Package domain define as entidades e tipos do contexto Notification.
package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// OwnerTipo identifica se o dono de um push token (ou destinatário de uma
// notificação) é um personal ou um aluno — mesmo vocabulário nos dois
// papéis porque ambos podem receber notificações e registrar tokens.
type OwnerTipo string

const (
	OwnerPersonal OwnerTipo = "PERSONAL"
	OwnerAluno    OwnerTipo = "ALUNO"
)

// Plataforma identifica o SO do dispositivo que gerou o token Expo.
type Plataforma string

const (
	PlataformaAndroid Plataforma = "ANDROID"
	PlataformaIOS     Plataforma = "IOS"
)

// PushToken é um token Expo Push registrado por um device — gerado no
// cliente (mobile) e enviado ao backend após login.
type PushToken struct {
	ID           uuid.UUID
	OwnerID      uuid.UUID
	OwnerTipo    OwnerTipo
	Token        string
	Plataforma   Plataforma
	Ativo        bool
	RegistradoEm time.Time
	AtualizadoEm time.Time
}

// TipoNotificacao categoriza a notificação. Deliberadamente string livre
// (não enum fechado no banco) — ver comentário na migration 000008: novos
// tipos vão nascer conforme outros contextos (Financial, Chat,
// Gamification) forem implementados, sem exigir migration a cada um.
type TipoNotificacao string

// TipoTreinoConcluido, TipoMensalidadePaga e TipoMensalidadeVencendo têm
// gatilho real implementado — os demais do SDD (PR_BATIDO, MENSAGEM_RECEBIDA,
// BADGE_DESBLOQUEADO) dependem de lógica/contextos que ainda não existem.
const (
	TipoTreinoConcluido     TipoNotificacao = "TREINO_CONCLUIDO"
	TipoMensalidadePaga     TipoNotificacao = "MENSALIDADE_PAGA"
	TipoMensalidadeVencendo TipoNotificacao = "MENSALIDADE_VENCENDO"
)

// StatusEntrega é o estado de despacho de uma notificação, avançado pelo
// worker (internal/notification/worker).
type StatusEntrega string

const (
	StatusPendente StatusEntrega = "PENDENTE"
	StatusEnviada  StatusEntrega = "ENVIADA"
	StatusErro     StatusEntrega = "ERRO"
)

// Notificacao é o registro persistido de uma notificação — criada com
// status PENDENTE por um caso de uso de domínio (ex: ConcluirSessao do
// Execution) e processada assincronamente pelo worker.
type Notificacao struct {
	ID               uuid.UUID
	DestinatarioID   uuid.UUID
	DestinatarioTipo OwnerTipo
	Titulo           string
	Corpo            string
	Tipo             TipoNotificacao
	DadosExtras      json.RawMessage
	Status           StatusEntrega
	ErroDetalhe      *string
	CriadoEm         time.Time
	EnviadoEm        *time.Time
}
