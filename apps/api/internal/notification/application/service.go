// Package application contém os casos de uso do contexto Notification.
package application

import (
	"context"
	"fmt"
	"strings"

	"github.com/amfit/api/internal/notification/domain"
	"github.com/google/uuid"
)

// NotificationService implementa os casos de uso de push tokens e
// notificações. Não fala com a Expo Push API diretamente — isso é
// responsabilidade do worker (internal/notification/worker), que consome
// a fila que este service popula.
type NotificationService struct {
	tokens domain.PushTokenRepository
	notifs domain.NotificacaoRepository
}

// NewNotificationService monta o service com as dependências necessárias.
func NewNotificationService(
	tokens domain.PushTokenRepository,
	notifs domain.NotificacaoRepository,
) *NotificationService {
	return &NotificationService{tokens: tokens, notifs: notifs}
}

// RegistrarPushTokenRequest é o payload de POST /push-token.
type RegistrarPushTokenRequest struct {
	Token      string
	Plataforma domain.Plataforma
}

// RegistrarPushToken salva (ou reativa) o token Expo de um device.
// OwnerID/OwnerTipo vêm do usuário autenticado (personal ou aluno) — o
// caller resolve isso do JWT antes de chamar.
func (s *NotificationService) RegistrarPushToken(
	ctx context.Context,
	ownerID uuid.UUID,
	ownerTipo domain.OwnerTipo,
	req RegistrarPushTokenRequest,
) error {
	token := strings.TrimSpace(req.Token)
	if token == "" {
		return domain.ErrTokenInvalido
	}

	pt := &domain.PushToken{
		ID:         uuid.New(),
		OwnerID:    ownerID,
		OwnerTipo:  ownerTipo,
		Token:      token,
		Plataforma: req.Plataforma,
		Ativo:      true,
	}
	if err := s.tokens.Upsert(ctx, pt); err != nil {
		return fmt.Errorf("application: upsert push token: %w", err)
	}
	return nil
}

// NotificarTreinoConcluido enfileira uma notificação pro personal quando um
// aluno conclui um treino (SDD §13.2, evento sessao.concluida). Satisfaz o
// port Notifier definido em execution/application — chamado diretamente
// por ExecutionService.ConcluirSessao, sem barramento de eventos (não há
// nenhum nesse codebase ainda; um port simples resolve sem introduzir essa
// abstração antes de precisar dela em mais de um lugar).
func (s *NotificationService) NotificarTreinoConcluido(
	ctx context.Context,
	personalID uuid.UUID,
	alunoNome string,
) error {
	n := &domain.Notificacao{
		ID:               uuid.New(),
		DestinatarioID:   personalID,
		DestinatarioTipo: domain.OwnerPersonal,
		Titulo:           "Treino concluído",
		Corpo:            fmt.Sprintf("%s concluiu o treino de hoje.", alunoNome),
		Tipo:             domain.TipoTreinoConcluido,
		Status:           domain.StatusPendente,
	}
	if err := s.notifs.Criar(ctx, n); err != nil {
		return fmt.Errorf("application: criar notificacao treino concluido: %w", err)
	}
	return nil
}
