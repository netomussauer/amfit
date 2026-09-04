package application

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/amfit/api/internal/identity/domain"
	"github.com/google/uuid"
)

func newTenantServiceForTest() (*TenantService, *mockTenantConfigRepo, *mockLogoStorage) {
	configs := &mockTenantConfigRepo{}
	storage := &mockLogoStorage{}
	return NewTenantService(configs, storage), configs, storage
}

// ── ObterConfig ────────────────────────────────────────────────────────────

func TestObterConfig_SemConfigCustomizada_DevolveDefaults(t *testing.T) {
	svc, configs, _ := newTenantServiceForTest()
	configs.findByPersonalIDFn = func(ctx context.Context, id uuid.UUID) (*domain.TenantConfig, error) {
		return nil, nil // nenhuma linha ainda
	}

	resp, err := svc.ObterConfig(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if resp.CorPrimaria != corPrimariaDefault || resp.CorSecundaria != corSecundariaDefault {
		t.Errorf("esperado defaults (%s/%s), got (%s/%s)",
			corPrimariaDefault, corSecundariaDefault, resp.CorPrimaria, resp.CorSecundaria)
	}
	if resp.LogoURL != nil || resp.NomeApp != nil {
		t.Errorf("logo/nome_app deveriam ficar nil sem config, got %+v", resp)
	}
}

func TestObterConfig_ComConfigCustomizada_DevolveValoresSalvos(t *testing.T) {
	svc, configs, _ := newTenantServiceForTest()
	personalID := uuid.New()
	configs.findByPersonalIDFn = func(ctx context.Context, id uuid.UUID) (*domain.TenantConfig, error) {
		return &domain.TenantConfig{
			PersonalID: id, LogoURL: "https://x/logo.png",
			CorPrimaria: "112233", CorSecundaria: "445566", NomeApp: "Studio X",
		}, nil
	}

	resp, err := svc.ObterConfig(context.Background(), personalID)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if resp.CorPrimaria != "112233" || resp.CorSecundaria != "445566" {
		t.Errorf("cores incorretas: %+v", resp)
	}
	if resp.LogoURL == nil || *resp.LogoURL != "https://x/logo.png" {
		t.Errorf("logo_url incorreto: %+v", resp)
	}
	if resp.NomeApp == nil || *resp.NomeApp != "Studio X" {
		t.Errorf("nome_app incorreto: %+v", resp)
	}
}

// ── AtualizarConfig ──────────────────────────────────────────────────────

func TestAtualizarConfig_PrimeiraVez_CriaComDefaultsParaCamposNaoInformados(t *testing.T) {
	svc, configs, _ := newTenantServiceForTest()
	personalID := uuid.New()
	configs.findByPersonalIDFn = func(ctx context.Context, id uuid.UUID) (*domain.TenantConfig, error) {
		return nil, nil
	}

	var salvo *domain.TenantConfig
	configs.upsertFn = func(ctx context.Context, cfg *domain.TenantConfig) error {
		salvo = cfg
		return nil
	}

	nomeApp := "Studio X"
	resp, err := svc.AtualizarConfig(context.Background(), personalID, AtualizarTenantConfigRequest{
		NomeApp: &nomeApp,
	}, nil)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if salvo.CorPrimaria != corPrimariaDefault || salvo.CorSecundaria != corSecundariaDefault {
		t.Errorf("cores não informadas deveriam manter o default, got %+v", salvo)
	}
	if salvo.NomeApp != "Studio X" {
		t.Errorf("nome_app não foi salvo: %+v", salvo)
	}
	if resp.NomeApp == nil || *resp.NomeApp != "Studio X" {
		t.Errorf("resposta incorreta: %+v", resp)
	}
}

func TestAtualizarConfig_CorComHashtag_NormalizaSemHashtag(t *testing.T) {
	svc, configs, _ := newTenantServiceForTest()
	var salvo *domain.TenantConfig
	configs.upsertFn = func(ctx context.Context, cfg *domain.TenantConfig) error {
		salvo = cfg
		return nil
	}

	cor := "#AABBCC"
	_, err := svc.AtualizarConfig(context.Background(), uuid.New(), AtualizarTenantConfigRequest{
		CorPrimaria: &cor,
	}, nil)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if salvo.CorPrimaria != "aabbcc" {
		t.Errorf("cor deveria ser normalizada pra minúsculo sem #, got %q", salvo.CorPrimaria)
	}
}

func TestAtualizarConfig_CorInvalida_RetornaErro(t *testing.T) {
	svc, _, _ := newTenantServiceForTest()

	casos := []string{"12345", "gggggg", "#12345g", ""}
	for _, cor := range casos {
		t.Run(cor, func(t *testing.T) {
			_, err := svc.AtualizarConfig(context.Background(), uuid.New(), AtualizarTenantConfigRequest{
				CorPrimaria: &cor,
			}, nil)
			if !errors.Is(err, domain.ErrCorInvalida) {
				t.Fatalf("esperado ErrCorInvalida pra %q, got %v", cor, err)
			}
		})
	}
}

func TestAtualizarConfig_CamposNaoInformados_PreservamValorExistente(t *testing.T) {
	svc, configs, _ := newTenantServiceForTest()
	personalID := uuid.New()
	configs.findByPersonalIDFn = func(ctx context.Context, id uuid.UUID) (*domain.TenantConfig, error) {
		return &domain.TenantConfig{
			PersonalID: id, CorPrimaria: "111111", CorSecundaria: "222222", NomeApp: "Nome Antigo",
		}, nil
	}
	var salvo *domain.TenantConfig
	configs.upsertFn = func(ctx context.Context, cfg *domain.TenantConfig) error {
		salvo = cfg
		return nil
	}

	novaCorPrimaria := "333333"
	_, err := svc.AtualizarConfig(context.Background(), personalID, AtualizarTenantConfigRequest{
		CorPrimaria: &novaCorPrimaria,
	}, nil)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if salvo.CorPrimaria != "333333" {
		t.Errorf("cor_primaria deveria ter sido atualizada, got %q", salvo.CorPrimaria)
	}
	if salvo.CorSecundaria != "222222" || salvo.NomeApp != "Nome Antigo" {
		t.Errorf("campos não informados deveriam ser preservados, got %+v", salvo)
	}
}

func TestAtualizarConfig_ComLogo_FazUploadESalvaURL(t *testing.T) {
	svc, configs, storage := newTenantServiceForTest()
	personalID := uuid.New()

	var salvo *domain.TenantConfig
	configs.upsertFn = func(ctx context.Context, cfg *domain.TenantConfig) error {
		salvo = cfg
		return nil
	}

	var personalIDRecebido uuid.UUID
	storage.uploadLogoFn = func(ctx context.Context, id uuid.UUID, logo *LogoUpload) (string, error) {
		personalIDRecebido = id
		return "https://minio/tenant-logos/" + id.String() + ".png", nil
	}

	logo := &LogoUpload{Filename: "logo.png", ContentType: "image/png", Size: 1024, Reader: strings.NewReader("fake")}
	resp, err := svc.AtualizarConfig(context.Background(), personalID, AtualizarTenantConfigRequest{}, logo)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if personalIDRecebido != personalID {
		t.Errorf("UploadLogo recebeu personal_id errado: %v", personalIDRecebido)
	}
	if salvo.LogoURL == "" {
		t.Error("logo_url deveria ter sido salva")
	}
	if resp.LogoURL == nil || *resp.LogoURL != salvo.LogoURL {
		t.Errorf("resposta com logo_url incorreta: %+v", resp)
	}
}

func TestAtualizarConfig_LogoTipoInvalido_NaoChamaStorageNemUpsert(t *testing.T) {
	svc, configs, storage := newTenantServiceForTest()

	chamouUpload := false
	storage.uploadLogoFn = func(ctx context.Context, id uuid.UUID, logo *LogoUpload) (string, error) {
		chamouUpload = true
		return "", nil
	}
	chamouUpsert := false
	configs.upsertFn = func(ctx context.Context, cfg *domain.TenantConfig) error {
		chamouUpsert = true
		return nil
	}

	logo := &LogoUpload{Filename: "logo.pdf", ContentType: "application/pdf", Size: 1024, Reader: strings.NewReader("x")}
	_, err := svc.AtualizarConfig(context.Background(), uuid.New(), AtualizarTenantConfigRequest{}, logo)
	if !errors.Is(err, domain.ErrTipoLogoInvalido) {
		t.Fatalf("esperado ErrTipoLogoInvalido, got %v", err)
	}
	if chamouUpload {
		t.Error("UploadLogo não deveria ter sido chamado com tipo inválido")
	}
	if chamouUpsert {
		t.Error("Upsert não deveria ter sido chamado com tipo de logo inválido")
	}
}

func TestAtualizarConfig_LogoTamanhoExcedido_RetornaErro(t *testing.T) {
	svc, _, _ := newTenantServiceForTest()

	logo := &LogoUpload{
		Filename: "logo.png", ContentType: "image/png",
		Size: maxLogoBytes + 1, Reader: strings.NewReader("x"),
	}
	_, err := svc.AtualizarConfig(context.Background(), uuid.New(), AtualizarTenantConfigRequest{}, logo)
	if !errors.Is(err, domain.ErrLogoTamanhoExcedido) {
		t.Fatalf("esperado ErrLogoTamanhoExcedido, got %v", err)
	}
}
