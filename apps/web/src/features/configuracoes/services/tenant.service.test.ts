import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tenantService } from './tenant.service';

const { mockedGet, mockedPatch, mockedPost } = vi.hoisted(() => ({
  mockedGet: vi.fn(),
  mockedPatch: vi.fn(),
  mockedPost: vi.fn(),
}));

vi.mock('@/shared/lib/api-client', () => ({
  apiClient: { get: mockedGet, patch: mockedPatch, post: mockedPost },
}));

const configFixture = {
  logo_url: 'https://minio.amfit.local/tenant-logos/abc.png',
  cor_primaria: 'f97316',
  cor_secundaria: 'ea580c',
  nome_app: 'Studio X',
};

describe('tenantService.getMinhaConfig', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('busca /tenants/me/config e retorna os dados quando a resposta é válida', async () => {
    mockedGet.mockResolvedValueOnce({ data: configFixture });

    const resultado = await tenantService.getMinhaConfig();

    expect(mockedGet).toHaveBeenCalledWith('/tenants/me/config');
    expect(resultado).toEqual(configFixture);
  });

  it('lança quando a resposta não bate com o schema', async () => {
    mockedGet.mockResolvedValueOnce({ data: { cor_primaria: 'não-hex-válido' } });

    await expect(tenantService.getMinhaConfig()).rejects.toThrow();
  });
});

describe('tenantService.atualizarConfig', () => {
  beforeEach(() => {
    mockedPatch.mockReset();
  });

  it('envia só os campos de texto informados como multipart, sem logo', async () => {
    mockedPatch.mockResolvedValueOnce({ data: configFixture });

    await tenantService.atualizarConfig({ cor_primaria: 'f97316' }, null);

    expect(mockedPatch).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockedPatch.mock.calls[0];
    expect(url).toBe('/tenants/me/config');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('cor_primaria')).toBe('f97316');
    expect((body as FormData).get('logo')).toBeNull();
    // undefined (não um valor fixo) — deixa o browser gerar o boundary do
    // multipart sozinho (ver comentário em tenant.service.ts).
    expect(config).toEqual({ headers: { 'Content-Type': undefined } });
  });

  it('inclui o arquivo de logo no FormData quando informado', async () => {
    mockedPatch.mockResolvedValueOnce({ data: configFixture });
    const logo = new File(['fake'], 'logo.png', { type: 'image/png' });

    await tenantService.atualizarConfig({}, logo);

    const body = mockedPatch.mock.calls[0][1] as FormData;
    expect(body.get('logo')).toBe(logo);
  });
});

describe('tenantService.regenerarCodigo', () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it('chama POST /tenants/me/codigo/regenerar e devolve a config com o código novo', async () => {
    mockedPost.mockResolvedValueOnce({ data: { ...configFixture, codigo: 'K7M2QX9P' } });

    const resultado = await tenantService.regenerarCodigo();

    expect(mockedPost).toHaveBeenCalledWith('/tenants/me/codigo/regenerar');
    expect(resultado.codigo).toBe('K7M2QX9P');
  });

  it('lança quando o código devolvido não tem o formato de convite', async () => {
    mockedPost.mockResolvedValueOnce({ data: { ...configFixture, codigo: 'k7m2qx0p' } });

    await expect(tenantService.regenerarCodigo()).rejects.toThrow();
  });
});
