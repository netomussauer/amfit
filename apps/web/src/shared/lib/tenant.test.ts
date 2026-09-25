import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicTenantConfig, tenantConfigToCssVars } from './tenant';

// `tenant.ts` importa next/headers (só usado por getTenantConfig).
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

const CODIGO = 'K7M2QX9P';

const configPublica = {
  logo_url: 'https://minio.amfit.local/tenant-logos/abc',
  cor_primaria: '112233',
  cor_secundaria: '445566',
  nome_app: 'Studio X',
};

const fetchMock = vi.fn();

describe('getPublicTenantConfig', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('busca a config pública sem enviar credenciais e devolve os dados', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => configPublica });

    const config = await getPublicTenantConfig(CODIGO);

    expect(config).toEqual(configPublica);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(new RegExp(`/api/v1/public/tenants/${CODIGO}/config$`));
    expect(init.cache).toBe('no-store');
    expect(init.headers).toBeUndefined();
  });

  it('não chama a API para código malformado', async () => {
    for (const codigo of ['', 'abc', 'k7m2qx9p', 'K7M2QX0P', 'K7M2QX9PA', '../etc']) {
      expect(await getPublicTenantConfig(codigo)).toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('devolve null quando o código não existe (404)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });

    expect(await getPublicTenantConfig(CODIGO)).toBeNull();
  });

  it('devolve null quando a resposta não bate com o schema', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ cor_primaria: 'não-hex', cor_secundaria: 'x' }),
    });

    expect(await getPublicTenantConfig(CODIGO)).toBeNull();
  });

  it('devolve null (não lança) quando a rede falha', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    expect(await getPublicTenantConfig(CODIGO)).toBeNull();
  });
});

describe('tenantConfigToCssVars', () => {
  it('monta as CSS vars a partir das cores', () => {
    expect(tenantConfigToCssVars({ cor_primaria: '112233', cor_secundaria: '445566' })).toEqual({
      '--color-primary': '#112233',
      '--color-primary-hover': '#445566',
    });
  });

  it('devolve undefined sem config (deixa valer o visual padrão)', () => {
    expect(tenantConfigToCssVars(null)).toBeUndefined();
  });
});
