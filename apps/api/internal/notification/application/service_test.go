package application

import (
	"context"
	"errors"
	"testing"

	"github.com/amfit/api/internal/notification/domain"
	"github.com/google/uuid"
)

func TestRegistrarPushToken_TokenVazio_RetornaErro(t *testing.T) {
	tokens := &mockTokenRepo{}
	svc := NewNotificationService(tokens, &mockNotifRepo{})

	chamou := false
	tokens.upsertFn = func(ctx context.Context, tk *domain.PushToken) error {
		chamou = true
		return nil
	}

	err := svc.RegistrarPushToken(context.Background(), uuid.New(), domain.OwnerAluno, RegistrarPushTokenRequest{
		Token: "   ", Plataforma: domain.PlataformaAndroid,
	})
	if !errors.Is(err, domain.ErrTokenInvalido) {
		t.Fatalf("esperado ErrTokenInvalido, got %v", err)
	}
	if chamou {
		t.Error("Upsert não deveria ter sido chamado com token vazio")
	}
}

func TestRegistrarPushToken_CaminhoFeliz_Upserta(t *testing.T) {
	tokens := &mockTokenRepo{}
	svc := NewNotificationService(tokens, &mockNotifRepo{})

	ownerID := uuid.New()
	var salvo *domain.PushToken
	tokens.upsertFn = func(ctx context.Context, tk *domain.PushToken) error {
		salvo = tk
		return nil
	}

	err := svc.RegistrarPushToken(context.Background(), ownerID, domain.OwnerPersonal, RegistrarPushTokenRequest{
		Token: "ExponentPushToken[abc123]", Plataforma: domain.PlataformaIOS,
	})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if salvo == nil || salvo.OwnerID != ownerID || salvo.OwnerTipo != domain.OwnerPersonal {
		t.Fatalf("push token salvo incorretamente: %+v", salvo)
	}
	if salvo.Token != "ExponentPushToken[abc123]" || salvo.Plataforma != domain.PlataformaIOS {
		t.Errorf("dados do token incorretos: %+v", salvo)
	}
	if !salvo.Ativo {
		t.Error("token novo deveria vir ativo")
	}
}

func TestNotificarTreinoConcluido_CriaNotificacaoPendente(t *testing.T) {
	notifs := &mockNotifRepo{}
	svc := NewNotificationService(&mockTokenRepo{}, notifs)

	personalID := uuid.New()
	var criada *domain.Notificacao
	notifs.criarFn = func(ctx context.Context, n *domain.Notificacao) error {
		criada = n
		return nil
	}

	if err := svc.NotificarTreinoConcluido(context.Background(), personalID, "João"); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}

	if criada == nil {
		t.Fatal("notificação não foi criada")
	}
	if criada.DestinatarioID != personalID || criada.DestinatarioTipo != domain.OwnerPersonal {
		t.Errorf("destinatário incorreto: %+v", criada)
	}
	if criada.Status != domain.StatusPendente {
		t.Errorf("status inicial deveria ser PENDENTE, got %s", criada.Status)
	}
	if criada.Tipo != domain.TipoTreinoConcluido {
		t.Errorf("tipo incorreto: %s", criada.Tipo)
	}
	if criada.Corpo == "" || criada.Titulo == "" {
		t.Error("titulo/corpo não deveriam ficar vazios")
	}
}

func TestNotificarTreinoConcluido_PropagaErroDoRepositorio(t *testing.T) {
	notifs := &mockNotifRepo{}
	svc := NewNotificationService(&mockTokenRepo{}, notifs)

	boom := errors.New("db indisponível")
	notifs.criarFn = func(ctx context.Context, n *domain.Notificacao) error {
		return boom
	}

	err := svc.NotificarTreinoConcluido(context.Background(), uuid.New(), "João")
	if err == nil {
		t.Fatal("esperado erro propagado do repositório")
	}
}
