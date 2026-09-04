package worker

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"

	"github.com/amfit/api/internal/notification/domain"
	"github.com/google/uuid"
)

// Os mocks abaixo protegem o estado compartilhado com mutex — processarPendentes
// despacha notificações em paralelo (maxDespachosConcorrentes), então mais de
// uma goroutine pode chamar estes métodos ao mesmo tempo durante os testes.

type mockNotifRepo struct {
	mu           sync.Mutex
	pendentes    []domain.Notificacao
	enviadaIDs   []uuid.UUID
	erroIDs      []uuid.UUID
	erroDetalhes []string
}

func (m *mockNotifRepo) Criar(ctx context.Context, n *domain.Notificacao) error { return nil }

func (m *mockNotifRepo) ListarPendentes(ctx context.Context, limit int) ([]domain.Notificacao, error) {
	return m.pendentes, nil
}

func (m *mockNotifRepo) MarcarEnviada(ctx context.Context, id uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.enviadaIDs = append(m.enviadaIDs, id)
	return nil
}

func (m *mockNotifRepo) MarcarErro(ctx context.Context, id uuid.UUID, detalhe string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.erroIDs = append(m.erroIDs, id)
	m.erroDetalhes = append(m.erroDetalhes, detalhe)
	return nil
}

type mockTokenRepo struct {
	tokensPorOwner map[uuid.UUID][]domain.PushToken
}

func (m *mockTokenRepo) Upsert(ctx context.Context, t *domain.PushToken) error { return nil }

func (m *mockTokenRepo) ListaAtivosPorOwner(
	ctx context.Context, ownerID uuid.UUID, ownerTipo domain.OwnerTipo,
) ([]domain.PushToken, error) {
	return m.tokensPorOwner[ownerID], nil
}

type mockExpoSender struct {
	mu           sync.Mutex
	sendFn       func(ctx context.Context, to, title, body string, data json.RawMessage) error
	enviosFeitos []string
}

func (m *mockExpoSender) Send(ctx context.Context, to, title, body string, data json.RawMessage) error {
	m.mu.Lock()
	m.enviosFeitos = append(m.enviosFeitos, to)
	m.mu.Unlock()
	if m.sendFn != nil {
		return m.sendFn(ctx, to, title, body, data)
	}
	return nil
}

func TestProcessarPendentes_SemTokenAtivo_MarcaEnviadaSilenciosamente(t *testing.T) {
	destinatarioID := uuid.New()
	n := domain.Notificacao{ID: uuid.New(), DestinatarioID: destinatarioID, DestinatarioTipo: domain.OwnerPersonal, Titulo: "t", Corpo: "c"}

	notifs := &mockNotifRepo{pendentes: []domain.Notificacao{n}}
	tokens := &mockTokenRepo{tokensPorOwner: map[uuid.UUID][]domain.PushToken{}}
	expo := &mockExpoSender{}

	d := NewDispatcher(notifs, tokens, expo, 0)
	d.processarPendentes(context.Background())

	if len(expo.enviosFeitos) != 0 {
		t.Errorf("Expo não deveria ter sido chamado sem token ativo, got %v", expo.enviosFeitos)
	}
	if len(notifs.enviadaIDs) != 1 || notifs.enviadaIDs[0] != n.ID {
		t.Errorf("notificação deveria ter sido marcada ENVIADA (silenciosa), got enviadas=%v erros=%v", notifs.enviadaIDs, notifs.erroIDs)
	}
	if len(notifs.erroIDs) != 0 {
		t.Errorf("não deveria haver erro, got %v", notifs.erroDetalhes)
	}
}

func TestProcessarPendentes_ComTokenAtivo_EnviaEMarcaEnviada(t *testing.T) {
	destinatarioID := uuid.New()
	n := domain.Notificacao{ID: uuid.New(), DestinatarioID: destinatarioID, DestinatarioTipo: domain.OwnerPersonal, Titulo: "Treino concluído", Corpo: "João concluiu"}

	notifs := &mockNotifRepo{pendentes: []domain.Notificacao{n}}
	tokens := &mockTokenRepo{tokensPorOwner: map[uuid.UUID][]domain.PushToken{
		destinatarioID: {{ID: uuid.New(), Token: "ExponentPushToken[xyz]"}},
	}}
	expo := &mockExpoSender{}

	d := NewDispatcher(notifs, tokens, expo, 0)
	d.processarPendentes(context.Background())

	if len(expo.enviosFeitos) != 1 || expo.enviosFeitos[0] != "ExponentPushToken[xyz]" {
		t.Errorf("Expo deveria ter sido chamado com o token ativo, got %v", expo.enviosFeitos)
	}
	if len(notifs.enviadaIDs) != 1 {
		t.Errorf("notificação deveria ter sido marcada ENVIADA, got %v", notifs.enviadaIDs)
	}
}

func TestProcessarPendentes_FalhaNoEnvio_MarcaErro(t *testing.T) {
	destinatarioID := uuid.New()
	n := domain.Notificacao{ID: uuid.New(), DestinatarioID: destinatarioID, DestinatarioTipo: domain.OwnerAluno, Titulo: "t", Corpo: "c"}

	notifs := &mockNotifRepo{pendentes: []domain.Notificacao{n}}
	tokens := &mockTokenRepo{tokensPorOwner: map[uuid.UUID][]domain.PushToken{
		destinatarioID: {{ID: uuid.New(), Token: "ExponentPushToken[invalido]"}},
	}}
	boom := errors.New("expo: invalid token")
	expo := &mockExpoSender{sendFn: func(ctx context.Context, to, title, body string, data json.RawMessage) error {
		return boom
	}}

	d := NewDispatcher(notifs, tokens, expo, 0)
	d.processarPendentes(context.Background())

	if len(notifs.erroIDs) != 1 || notifs.erroIDs[0] != n.ID {
		t.Errorf("notificação deveria ter sido marcada ERRO, got enviadas=%v erros=%v", notifs.enviadaIDs, notifs.erroIDs)
	}
	if len(notifs.enviadaIDs) != 0 {
		t.Error("não deveria ter sido marcada ENVIADA")
	}
}

func TestProcessarPendentes_MultiplasNotificacoes_ProcessaTodas(t *testing.T) {
	dest1, dest2 := uuid.New(), uuid.New()
	n1 := domain.Notificacao{ID: uuid.New(), DestinatarioID: dest1, DestinatarioTipo: domain.OwnerPersonal}
	n2 := domain.Notificacao{ID: uuid.New(), DestinatarioID: dest2, DestinatarioTipo: domain.OwnerAluno}

	notifs := &mockNotifRepo{pendentes: []domain.Notificacao{n1, n2}}
	tokens := &mockTokenRepo{tokensPorOwner: map[uuid.UUID][]domain.PushToken{
		dest1: {{ID: uuid.New(), Token: "tok1"}},
		dest2: {{ID: uuid.New(), Token: "tok2"}},
	}}
	expo := &mockExpoSender{}

	d := NewDispatcher(notifs, tokens, expo, 0)
	d.processarPendentes(context.Background())

	if len(expo.enviosFeitos) != 2 {
		t.Errorf("esperado 2 envios, got %d (%v)", len(expo.enviosFeitos), expo.enviosFeitos)
	}
	if len(notifs.enviadaIDs) != 2 {
		t.Errorf("esperado 2 notificações marcadas ENVIADA, got %d", len(notifs.enviadaIDs))
	}
}
