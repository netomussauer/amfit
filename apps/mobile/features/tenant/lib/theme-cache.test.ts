import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TenantConfigResponse } from '@amfit/shared';
import { getConfigCache, setConfigCache } from './theme-cache';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
const mockedSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;

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
