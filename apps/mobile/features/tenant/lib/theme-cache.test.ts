import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TenantConfigResponse } from '@amfit/shared';
import {
  clearConfigCache,
  clearPublicBranding,
  getConfigCache,
  getPublicBranding,
  setConfigCache,
  setPublicBranding,
} from './theme-cache';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
const mockedSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;
const mockedRemoveItem = AsyncStorage.removeItem as jest.MockedFunction<
  typeof AsyncStorage.removeItem
>;

const configFixture: TenantConfigResponse = {
  cor_primaria: '112233',
  cor_secundaria: '445566',
};

describe('getConfigCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('devolve null quando não há nada no cache', async () => {
    mockedGetItem.mockResolvedValue(null);

    const result = await getConfigCache();

    expect(result).toBeNull();
  });

  it('devolve stale=false para um cache recém-gravado', async () => {
    mockedGetItem.mockResolvedValue(
      JSON.stringify({ config: configFixture, cachedAt: Date.now() }),
    );

    const result = await getConfigCache();

    expect(result).toEqual({ config: configFixture, stale: false });
  });

  it('devolve stale=true para um cache com mais de 24h', async () => {
    const cachedAt = Date.now() - 25 * 60 * 60 * 1000;
    mockedGetItem.mockResolvedValue(JSON.stringify({ config: configFixture, cachedAt }));

    const result = await getConfigCache();

    expect(result).toEqual({ config: configFixture, stale: true });
  });

  it('devolve null (não lança) quando o cache está corrompido', async () => {
    mockedGetItem.mockResolvedValue('{ isso não é json válido');

    const result = await getConfigCache();

    expect(result).toBeNull();
  });
});

describe('setConfigCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('grava a config com o timestamp atual', async () => {
    await setConfigCache(configFixture);

    expect(mockedSetItem).toHaveBeenCalledTimes(1);
    const [key, raw] = mockedSetItem.mock.calls[0];
    expect(key).toBe('tenant_config');
    const parsed = JSON.parse(raw);
    expect(parsed.config).toEqual(configFixture);
    expect(typeof parsed.cachedAt).toBe('number');
  });
});

describe('clearConfigCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('apaga a chave da config autenticada', async () => {
    mockedRemoveItem.mockResolvedValue(undefined);

    await clearConfigCache();

    expect(mockedRemoveItem).toHaveBeenCalledWith('tenant_config');
  });

  it('nunca lança: falha ao apagar não pode impedir o logout', async () => {
    mockedRemoveItem.mockRejectedValue(new Error('storage indisponível'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(clearConfigCache()).resolves.toBeUndefined();

    warn.mockRestore();
  });
});

describe('branding público (antes do login)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('grava o convite (código + config) numa chave separada da config autenticada', async () => {
    await setPublicBranding('K7M2QX9P', configFixture);

    expect(mockedSetItem).toHaveBeenCalledTimes(1);
    const [chave, valor] = mockedSetItem.mock.calls[0];
    expect(chave).toBe('tenant_public_config');
    const gravado = JSON.parse(valor);
    expect(gravado.codigo).toBe('K7M2QX9P');
    expect(gravado.config).toEqual(configFixture);
    expect(typeof gravado.cachedAt).toBe('number');
  });

  it('devolve null quando não há convite guardado', async () => {
    mockedGetItem.mockResolvedValue(null);

    expect(await getPublicBranding()).toBeNull();
    expect(mockedGetItem).toHaveBeenCalledWith('tenant_public_config');
  });

  it('devolve o convite com stale=false quando recém-gravado', async () => {
    mockedGetItem.mockResolvedValue(
      JSON.stringify({ codigo: 'K7M2QX9P', config: configFixture, cachedAt: Date.now() }),
    );

    expect(await getPublicBranding()).toEqual({
      codigo: 'K7M2QX9P',
      config: configFixture,
      stale: false,
    });
  });

  it('marca stale=true depois do TTL de 24h', async () => {
    mockedGetItem.mockResolvedValue(
      JSON.stringify({
        codigo: 'K7M2QX9P',
        config: configFixture,
        cachedAt: Date.now() - 25 * 60 * 60 * 1000,
      }),
    );

    expect((await getPublicBranding())?.stale).toBe(true);
  });

  it('devolve null para conteúdo corrompido ou sem código, em vez de lançar', async () => {
    mockedGetItem.mockResolvedValueOnce('{não é json');
    expect(await getPublicBranding()).toBeNull();

    mockedGetItem.mockResolvedValueOnce(JSON.stringify({ config: configFixture, cachedAt: 1 }));
    expect(await getPublicBranding()).toBeNull();
  });

  it('rejeita entrada sem cachedAt válido (senão nunca ficaria stale e nunca revalidaria)', async () => {
    mockedGetItem.mockResolvedValueOnce(
      JSON.stringify({ codigo: 'K7M2QX9P', config: configFixture }),
    );
    expect(await getPublicBranding()).toBeNull();

    mockedGetItem.mockResolvedValueOnce(
      JSON.stringify({ codigo: 'K7M2QX9P', config: configFixture, cachedAt: 'ontem' }),
    );
    expect(await getPublicBranding()).toBeNull();
  });

  it('rejeita config malformada (cor inválida, nome_app não-string)', async () => {
    mockedGetItem.mockResolvedValueOnce(
      JSON.stringify({
        codigo: 'K7M2QX9P',
        config: { cor_primaria: 'não-hex', cor_secundaria: '445566' },
        cachedAt: Date.now(),
      }),
    );
    expect(await getPublicBranding()).toBeNull();

    mockedGetItem.mockResolvedValueOnce(
      JSON.stringify({
        codigo: 'K7M2QX9P',
        config: { ...configFixture, nome_app: 123 },
        cachedAt: Date.now(),
      }),
    );
    expect(await getPublicBranding()).toBeNull();
  });

  it('clearPublicBranding apaga só a chave do convite e nunca lança', async () => {
    mockedRemoveItem.mockResolvedValueOnce(undefined);
    await clearPublicBranding();
    expect(mockedRemoveItem).toHaveBeenCalledWith('tenant_public_config');

    mockedRemoveItem.mockRejectedValueOnce(new Error('falhou'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(clearPublicBranding()).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
