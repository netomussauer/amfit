package application

import (
	"context"
	"fmt"
	"io"
	"regexp"
	"strings"

	"github.com/amfit/api/internal/identity/domain"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// Defaults idênticos ao visual atual do app (--color-primary/-hover no web,
// tailwind.config no mobile) — um personal sem branding customizado não
// deve ver NENHUMA diferença visual.
const (
	corPrimariaDefault   = "f97316"
	corSecundariaDefault = "ea580c"

	maxLogoBytes = 2 * 1024 * 1024 // 2 MB — logo é pequeno, bem mais restrito que mídia de exercício
)

var hexColorPattern = regexp.MustCompile(`^[0-9a-fA-F]{6}$`)

// LogoUpload carrega o arquivo de logo recebido no multipart do PUT
// /tenants/me/config. Mesmo shape de catalog.application.MidiaUpload, mas
// port próprio — Identity não importa Catalog só por causa desse tipo.
type LogoUpload struct {
	Filename    string
	ContentType string
	Size        int64
	Reader      io.Reader
}

// LogoStorage é o port de armazenamento do logo — implementado em
// infrastructure via MinIO (bucket "tenant-logos", público).
type LogoStorage interface {
	UploadLogo(ctx context.Context, personalID uuid.UUID, logo *LogoUpload) (string, error)
}

// TenantService implementa os casos de uso de White Label (SDD §20.4):
// branding (logo, cores, nome do app) por personal, lido pelo próprio
// personal e por seus alunos.
type TenantService struct {
	configs domain.TenantConfigRepository
	storage LogoStorage
}

// NewTenantService monta o service com as dependências necessárias.
func NewTenantService(
	configs domain.TenantConfigRepository,
	storage LogoStorage,
) *TenantService {
	return &TenantService{configs: configs, storage: storage}
}

// ObterConfig devolve a config de branding do personal informado.
//
// Resolução de quem é "o personal" fica no handler (não aqui): o JWT do
// aluno já carrega o claim `tenant_id` com o personal_id dele (mesmo
// padrão usado em catalog/handlers/helpers.go, personalIDForList) — não
// há necessidade de olhar a tabela `aluno`, nem de replicar aqui o design
// original do SDD (GET público por "código", que pressupõe um fluxo de
// convite/QR-code pré-login que este app não tem — alunos são criados
// diretamente pelo personal).
func (s *TenantService) ObterConfig(ctx context.Context, personalID uuid.UUID) (*TenantConfigResponse, error) {
	cfg, err := s.configs.FindByPersonalID(ctx, personalID)
	if err != nil {
		return nil, fmt.Errorf("application: find tenant config: %w", err)
	}
	if cfg == nil {
		return &TenantConfigResponse{
			CorPrimaria:   corPrimariaDefault,
			CorSecundaria: corSecundariaDefault,
		}, nil
	}
	return tenantConfigToResponse(cfg), nil
}

// AtualizarConfig atualiza a config de branding do personal autenticado.
// Campos não informados mantêm o valor atual (ou o default, se ainda não
// havia config nenhuma).
func (s *TenantService) AtualizarConfig(
	ctx context.Context,
	personalID uuid.UUID,
	req AtualizarTenantConfigRequest,
	logo *LogoUpload,
) (*TenantConfigResponse, error) {
	existente, err := s.configs.FindByPersonalID(ctx, personalID)
	if err != nil {
		return nil, fmt.Errorf("application: find tenant config: %w", err)
	}

	cfg := existente
	if cfg == nil {
		cfg = &domain.TenantConfig{
			PersonalID:    personalID,
			CorPrimaria:   corPrimariaDefault,
			CorSecundaria: corSecundariaDefault,
		}
	}

	if req.CorPrimaria != nil {
		cor, err := normalizarCorHex(*req.CorPrimaria)
		if err != nil {
			return nil, err
		}
		cfg.CorPrimaria = cor
	}
	if req.CorSecundaria != nil {
		cor, err := normalizarCorHex(*req.CorSecundaria)
		if err != nil {
			return nil, err
		}
		cfg.CorSecundaria = cor
	}
	if req.NomeApp != nil {
		cfg.NomeApp = strings.TrimSpace(*req.NomeApp)
	}

	if logo != nil {
		if err := validarLogo(logo.ContentType, logo.Size); err != nil {
			return nil, err
		}
		url, err := s.storage.UploadLogo(ctx, personalID, logo)
		if err != nil {
			return nil, fmt.Errorf("application: upload logo: %w", err)
		}
		cfg.LogoURL = url
	}

	if err := s.configs.Upsert(ctx, cfg); err != nil {
		return nil, fmt.Errorf("application: upsert tenant config: %w", err)
	}

	log.Info().Str("personal_id", personalID.String()).Msg("tenant config atualizada")

	return tenantConfigToResponse(cfg), nil
}

// normalizarCorHex aceita a cor com ou sem "#" e devolve sempre em
// minúsculas, sem "#" (formato persistido).
func normalizarCorHex(raw string) (string, error) {
	cor := strings.TrimPrefix(strings.TrimSpace(raw), "#")
	if !hexColorPattern.MatchString(cor) {
		return "", domain.ErrCorInvalida
	}
	return strings.ToLower(cor), nil
}

// validarLogo restringe o logo a jpeg/png e a um teto de tamanho bem menor
// que o de mídia de exercício — é um ícone, não um vídeo demonstrativo.
func validarLogo(contentType string, size int64) error {
	if size <= 0 {
		return domain.ErrTipoLogoInvalido
	}

	ct := strings.ToLower(strings.TrimSpace(contentType))
	if i := strings.Index(ct, ";"); i >= 0 {
		ct = strings.TrimSpace(ct[:i])
	}

	switch ct {
	case "image/jpeg", "image/jpg", "image/png":
		if size > maxLogoBytes {
			return domain.ErrLogoTamanhoExcedido
		}
		return nil
	default:
		return domain.ErrTipoLogoInvalido
	}
}

func tenantConfigToResponse(cfg *domain.TenantConfig) *TenantConfigResponse {
	resp := &TenantConfigResponse{
		CorPrimaria:   cfg.CorPrimaria,
		CorSecundaria: cfg.CorSecundaria,
	}
	if cfg.LogoURL != "" {
		logoURL := cfg.LogoURL
		resp.LogoURL = &logoURL
	}
	if cfg.NomeApp != "" {
		nomeApp := cfg.NomeApp
		resp.NomeApp = &nomeApp
	}
	return resp
}
