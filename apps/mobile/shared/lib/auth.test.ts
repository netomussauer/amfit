import * as SecureStore from 'expo-secure-store';
import {
  clearAll,
  getAccessToken,
  getCurrentUser,
  getDisplayName,
  getRefreshToken,
  parseJwt,
  removeAccessToken,
  removeRefreshToken,
  setAccessToken,
  setRefreshToken,
} from './auth';

// SecureStore em memoria: o modulo nativo nao existe no ambiente de teste.
const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockStore.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    mockStore.delete(k);
  }),
}));

// JWT sem assinatura valida — parseJwt so le o payload. Codifica em UTF-8 +
// base64url, igual ao que o backend Go emite.
function jwtComPayload(payload: object): string {
  const b64url = (s: string) =>
    Buffer.from(s, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url('{"alg":"RS256"}')}.${b64url(JSON.stringify(payload))}.assinatura`;
}

describe('armazenamento de tokens', () => {
  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
  });

  it('access token: retorna null quando nao existe, grava e remove', async () => {
    expect(await getAccessToken()).toBeNull();

    await setAccessToken('abc');
    expect(await getAccessToken()).toBe('abc');

    await removeAccessToken();
    expect(await getAccessToken()).toBeNull();
  });

  it('refresh token: retorna null quando nao existe, grava e remove', async () => {
    expect(await getRefreshToken()).toBeNull();

    await setRefreshToken('xyz');
    expect(await getRefreshToken()).toBe('xyz');

    await removeRefreshToken();
    expect(await getRefreshToken()).toBeNull();
  });

  it('access e refresh usam chaves diferentes (um nao sobrescreve o outro)', async () => {
    await setAccessToken('a');
    await setRefreshToken('r');

    expect(await getAccessToken()).toBe('a');
    expect(await getRefreshToken()).toBe('r');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('amfit_access_token', 'a');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('amfit_refresh_token', 'r');
  });

  it('clearAll remove os dois tokens', async () => {
    await setAccessToken('a');
    await setRefreshToken('r');

    await clearAll();

    expect(await getAccessToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
  });
});

describe('parseJwt', () => {
  it('le os claims do payload', () => {
    const token = jwtComPayload({ sub: 'u1', role: 'ALUNO', tenant_id: 't1', exp: 123, iat: 100 });

    expect(parseJwt(token)).toEqual({
      sub: 'u1',
      role: 'ALUNO',
      tenant_id: 't1',
      exp: 123,
      iat: 100,
    });
  });

  it('decodifica nomes com acentos e emoji (payload e UTF-8)', () => {
    const token = jwtComPayload({ sub: 'u1', name: 'João Ângelo Conceição 💪' });

    expect(parseJwt(token)?.name).toBe('João Ângelo Conceição 💪');
  });

  it('aceita base64url com caracteres - e _ e sem padding', () => {
    // 0xfb 0xff gera "+/" em base64 padrao => "-_" em base64url.
    const token = jwtComPayload({ sub: 'u1', blob: 'ûÿ???>>>' });

    expect(parseJwt(token)?.sub).toBe('u1');
  });

  it.each([
    ['string vazia', ''],
    ['sem segundo segmento', 'apenas-um-segmento'],
    ['segundo segmento vazio', 'a..c'],
    ['payload que nao e base64', 'a.@@@.c'],
    ['payload que nao e JSON', `a.${Buffer.from('nao-json').toString('base64')}.c`],
  ])('retorna null para token malformado (%s)', (_nome, token) => {
    expect(parseJwt(token)).toBeNull();
  });
});

describe('getCurrentUser', () => {
  beforeEach(() => mockStore.clear());

  it('retorna null sem access token salvo', async () => {
    expect(await getCurrentUser()).toBeNull();
  });

  it('retorna os claims do access token salvo', async () => {
    await setAccessToken(jwtComPayload({ sub: 'u9', role: 'PERSONAL' }));

    expect(await getCurrentUser()).toEqual({ sub: 'u9', role: 'PERSONAL' });
  });

  it('retorna null quando o token salvo esta corrompido', async () => {
    await setAccessToken('lixo');

    expect(await getCurrentUser()).toBeNull();
  });
});

describe('getDisplayName', () => {
  it('prefere o claim padrao "name"', () => {
    expect(getDisplayName({ name: 'Ana', nome: 'Ignorado' })).toBe('Ana');
  });

  it('cai para "nome" quando "name" nao existe', () => {
    expect(getDisplayName({ nome: 'Beto' })).toBe('Beto');
  });

  it.each([[null], [undefined], [{}]])('retorna undefined para %p', (payload) => {
    expect(getDisplayName(payload as never)).toBeUndefined();
  });
});
