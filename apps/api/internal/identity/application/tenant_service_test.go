package application

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/amfit/api/internal/identity/domain"
	"github.com/google/uuid"
)

// codigoTeste é um código de convite válido usado como padrão nos testes.
const codigoTeste = "K7M2QX9P"

func newTenantServiceForTest() (*TenantService, *mockTenantConfigRepo, *mockLogoStorage) {
	svc, configs, storage, _ := newTenantServiceComPersonais()
	return svc, configs, storage
}

// newTenantServiceComPersonais também expõe o mock de personal, para os
// testes do código de convite. Por padrão qualquer id de personal existe e
// tem `codigoTeste`.
func newTenantServiceComPersonais() (*TenantService, *mockTenantConfigRepo, *mockLogoStorage, *mockPersonalRepo) {
	configs := &mockTenantConfigRepo{}
	storage := &mockLogoStorage{}
	personais := &mockPersonalRepo{
		findByIDFn: func(_ context.Context, id uuid.UUID) (*domain.PersonalTrainer, error) {
			return &domain.PersonalTrainer{ID: id, Codigo: codigoTeste}, nil
		},
	}
	return NewTenantService(configs, personais, storage), configs, storage, personais
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

// ── Código de convite (white label nível 2, ADR-007) ──────────────────────

func TestObterConfigPorCodigo_Achado_DevolveConfigDoPersonalSemCodigo(t *testing.T) {
	svc, configs, _, personais := newTenantServiceComPersonais()
	personalID := uuid.New()
	personais.findByCodigoFn = func(_ context.Context, codigo string) (*domain.PersonalTrainer, error) {
		if codigo != codigoTeste {
			t.Errorf("FindByCodigo com %q, esperado %q", codigo, codigoTeste)
		}
		return &domain.PersonalTrainer{ID: personalID, Codigo: codigo, Ativo: true}, nil
	}
	configs.findByPersonalIDFn = func(_ context.Context, id uuid.UUID) (*domain.TenantConfig, error) {
		if id != personalID {
			t.Errorf("config buscada para %s, esperado %s", id, personalID)
		}
		return &domain.TenantConfig{
			PersonalID: id, CorPrimaria: "112233", CorSecundaria: "445566", NomeApp: "Studio X",
		}, nil
	}

	resp, err := svc.ObterConfigPorCodigo(context.Background(), codigoTeste)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if resp.CorPrimaria != "112233" || resp.NomeApp == nil || *resp.NomeApp != "Studio X" {
		t.Errorf("config incorreta: %+v", resp)
	}
	if resp.Codigo != "" {
		t.Errorf("resposta publica nao deve repetir o codigo, got %q", resp.Codigo)
	}
}

func TestObterConfigPorCodigo_SemConfigCustomizada_DevolveDefaults(t *testing.T) {
	svc, configs, _, personais := newTenantServiceComPersonais()
	personais.findByCodigoFn = func(_ context.Context, codigo string) (*domain.PersonalTrainer, error) {
		return &domain.PersonalTrainer{ID: uuid.New(), Codigo: codigo, Ativo: true}, nil
	}
	configs.findByPersonalIDFn = func(context.Context, uuid.UUID) (*domain.TenantConfig, error) {
		return nil, nil
	}

	resp, err := svc.ObterConfigPorCodigo(context.Background(), codigoTeste)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if resp.CorPrimaria != corPrimariaDefault || resp.CorSecundaria != corSecundariaDefault {
		t.Errorf("esperados defaults, got %+v", resp)
	}
}

func TestObterConfigPorCodigo_Inexistente_RetornaCodigoNotFound(t *testing.T) {
	svc, _, _, _ := newTenantServiceComPersonais() // FindByCodigo padrao: nao encontrado

	_, err := svc.ObterConfigPorCodigo(context.Background(), codigoTeste)
	if !errors.Is(err, domain.ErrCodigoNotFound) {
		t.Fatalf("esperado ErrCodigoNotFound, got %v", err)
	}
}

func TestObterConfigPorCodigo_PersonalDesativado_RetornaCodigoNotFound(t *testing.T) {
	svc, _, _, personais := newTenantServiceComPersonais()
	personais.findByCodigoFn = func(_ context.Context, codigo string) (*domain.PersonalTrainer, error) {
		return &domain.PersonalTrainer{ID: uuid.New(), Codigo: codigo, Ativo: false}, nil
	}

	_, err := svc.ObterConfigPorCodigo(context.Background(), codigoTeste)
	if !errors.Is(err, domain.ErrCodigoNotFound) {
		t.Fatalf("link de personal desativado deve dar ErrCodigoNotFound, got %v", err)
	}
}

func TestObterConfigPorCodigo_Malformado_NemConsultaOBanco(t *testing.T) {
	svc, _, _, personais := newTenantServiceComPersonais()
	consultou := false
	personais.findByCodigoFn = func(context.Context, string) (*domain.PersonalTrainer, error) {
		consultou = true
		return nil, domain.ErrPersonalNotFound
	}

	for _, codigo := range []string{"", "abc", "K7M2QX9", "K7M2QX9PZ", "k7m2qx9p", "K7M2QX0P"} {
		_, err := svc.ObterConfigPorCodigo(context.Background(), codigo)
		if !errors.Is(err, domain.ErrCodigoNotFound) {
			t.Errorf("codigo %q: esperado ErrCodigoNotFound, got %v", codigo, err)
		}
	}
	if consultou {
		t.Error("codigo malformado nao deveria consultar o repositorio")
	}
}

func TestObterConfigPorCodigo_ErroDeBanco_NaoViraNotFound(t *testing.T) {
	svc, _, _, personais := newTenantServiceComPersonais()
	personais.findByCodigoFn = func(context.Context, string) (*domain.PersonalTrainer, error) {
		return nil, errors.New("banco fora")
	}

	_, err := svc.ObterConfigPorCodigo(context.Background(), codigoTeste)
	if err == nil || errors.Is(err, domain.ErrCodigoNotFound) {
		t.Fatalf("erro de infraestrutura deve propagar (nao 404), got %v", err)
	}
}

func TestObterConfigDoPersonal_IncluiOCodigo(t *testing.T) {
	svc, configs, _, _ := newTenantServiceComPersonais()
	configs.findByPersonalIDFn = func(context.Context, uuid.UUID) (*domain.TenantConfig, error) {
		return nil, nil
	}

	resp, err := svc.ObterConfigDoPersonal(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if resp.Codigo != codigoTeste {
		t.Errorf("codigo esperado %q, got %q", codigoTeste, resp.Codigo)
	}
}

func TestObterConfig_Aluno_NaoIncluiOCodigo(t *testing.T) {
	svc, configs, _, _ := newTenantServiceComPersonais()
	configs.findByPersonalIDFn = func(context.Context, uuid.UUID) (*domain.TenantConfig, error) {
		return nil, nil
	}

	resp, err := svc.ObterConfig(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if resp.Codigo != "" {
		t.Errorf("ObterConfig (usado pelo aluno) nao deve incluir o codigo, got %q", resp.Codigo)
	}
}

func TestAtualizarConfig_RespostaIncluiOCodigo(t *testing.T) {
	svc, configs, _, _ := newTenantServiceComPersonais()
	configs.findByPersonalIDFn = func(context.Context, uuid.UUID) (*domain.TenantConfig, error) {
		return nil, nil
	}

	nome := "Studio X"
	resp, err := svc.AtualizarConfig(context.Background(), uuid.New(), AtualizarTenantConfigRequest{NomeApp: &nome}, nil)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if resp.Codigo != codigoTeste {
		t.Errorf("a resposta do PATCH deve manter o codigo (o portal grava no cache), got %q", resp.Codigo)
	}
}

func TestRegenerarCodigo_GravaNovoCodigoValidoEDevolveNaResposta(t *testing.T) {
	svc, configs, _, personais := newTenantServiceComPersonais()
	personalID := uuid.New()
	configs.findByPersonalIDFn = func(context.Context, uuid.UUID) (*domain.TenantConfig, error) {
		return nil, nil
	}

	var gravado string
	personais.updateCodigoFn = func(_ context.Context, id uuid.UUID, codigo string) error {
		if id != personalID {
			t.Errorf("UpdateCodigo para %s, esperado %s", id, personalID)
		}
		gravado = codigo
		return nil
	}
	personais.findByIDFn = func(_ context.Context, id uuid.UUID) (*domain.PersonalTrainer, error) {
		return &domain.PersonalTrainer{ID: id, Codigo: gravado}, nil
	}

	resp, err := svc.RegenerarCodigo(context.Background(), personalID)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if !domain.CodigoConviteValido(gravado) {
		t.Errorf("codigo gravado invalido: %q", gravado)
	}
	if resp.Codigo != gravado {
		t.Errorf("resposta deve trazer o codigo novo %q, got %q", gravado, resp.Codigo)
	}
}

func TestRegenerarCodigo_ColisaoSorteiaOutro(t *testing.T) {
	svc, configs, _, personais := newTenantServiceComPersonais()
	configs.findByPersonalIDFn = func(context.Context, uuid.UUID) (*domain.TenantConfig, error) {
		return nil, nil
	}
	chamadas := 0
	personais.updateCodigoFn = func(context.Context, uuid.UUID, string) error {
		chamadas++
		if chamadas == 1 {
			return domain.ErrCodigoEmUso
		}
		return nil
	}

	if _, err := svc.RegenerarCodigo(context.Background(), uuid.New()); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if chamadas != 2 {
		t.Errorf("esperadas 2 chamadas a UpdateCodigo, got %d", chamadas)
	}
}

func TestRegenerarCodigo_ColisaoPersistente_Desiste(t *testing.T) {
	svc, _, _, personais := newTenantServiceComPersonais()
	chamadas := 0
	personais.updateCodigoFn = func(context.Context, uuid.UUID, string) error {
		chamadas++
		return domain.ErrCodigoEmUso
	}

	_, err := svc.RegenerarCodigo(context.Background(), uuid.New())
	if !errors.Is(err, domain.ErrCodigoEmUso) {
		t.Fatalf("esperado ErrCodigoEmUso, got %v", err)
	}
	if chamadas != tentativasCodigoConvite {
		t.Errorf("esperadas %d tentativas, got %d", tentativasCodigoConvite, chamadas)
	}
}

func TestRegenerarCodigo_PersonalInexistente_PropagaErro(t *testing.T) {
	svc, _, _, personais := newTenantServiceComPersonais()
	personais.updateCodigoFn = func(context.Context, uuid.UUID, string) error {
		return domain.ErrPersonalNotFound
	}

	_, err := svc.RegenerarCodigo(context.Background(), uuid.New())
	if !errors.Is(err, domain.ErrPersonalNotFound) {
		t.Fatalf("esperado ErrPersonalNotFound, got %v", err)
	}
}
