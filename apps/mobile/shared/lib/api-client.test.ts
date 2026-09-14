import {
  apiRequest,
  ApiError,
  NetworkError,
  SyncAuthExpiredError,
  setAuthFailedHandler,
} from './api-client';
import * as auth from './auth';

jest.mock('./auth', () => ({
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
  setAccessToken: jest.fn(),
  setRefreshToken: jest.fn(),
  removeAccessToken: jest.fn(),
  clearAll: jest.fn(),
}));

const mockedAuth = auth as jest.Mocked<typeof auth>;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

describe('apiRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuth.getAccessToken.mockResolvedValue('token-123');
    mockedAuth.getRefreshToken.mockResolvedValue(null);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    setAuthFailedHandler(null);
  });

  it('retorna os dados parseados numa resposta 2xx', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(200, { ok: true }));

    const result = await apiRequest<{ ok: boolean }>('/algo');

    expect(result).toEqual({ ok: true });
  });

  it('lança NetworkError quando o fetch em si falha (sem conectividade)', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));

    await expect(apiRequest('/algo')).rejects.toThrow(NetworkError);
  });

  it('lança ApiError (não NetworkError) numa resposta HTTP de erro de verdade', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(500, 'erro interno'));

    const error = await apiRequest('/algo').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(NetworkError);
    expect((error as ApiError).status).toBe(500);
  });

  it('401 em endpoint de /auth/ vira ApiError sem tentar refresh nem disparar onAuthFailed', async () => {
    const onAuthFailed = jest.fn();
    setAuthFailedHandler(onAuthFailed);
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(401, 'credenciais inválidas'));

    const error = await apiRequest('/auth/login', { method: 'POST', body: {} }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect(mockedAuth.clearAll).not.toHaveBeenCalled();
    expect(onAuthFailed).not.toHaveBeenCalled();
  });

  it('401 fora de /auth/, sem isBackgroundSync e sem refresh possível, dispara clearAll + onAuthFailed', async () => {
    const onAuthFailed = jest.fn();
    setAuthFailedHandler(onAuthFailed);
    mockedAuth.getRefreshToken.mockResolvedValue(null);
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(401, 'expirado'));

    const error = await apiRequest('/sessoes/abc').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(SyncAuthExpiredError);
    expect(mockedAuth.clearAll).toHaveBeenCalledTimes(1);
    expect(onAuthFailed).toHaveBeenCalledTimes(1);
  });

  it('401 fora de /auth/ com isBackgroundSync=true lança SyncAuthExpiredError sem tocar em clearAll/onAuthFailed', async () => {
    const onAuthFailed = jest.fn();
    setAuthFailedHandler(onAuthFailed);
    mockedAuth.getRefreshToken.mockResolvedValue(null);
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(401, 'expirado'));

    const error = await apiRequest('/sessoes/abc', { isBackgroundSync: true }).catch((e) => e);

    expect(error).toBeInstanceOf(SyncAuthExpiredError);
    expect(mockedAuth.clearAll).not.toHaveBeenCalled();
    expect(onAuthFailed).not.toHaveBeenCalled();
  });

  it('401 fora de /auth/ quando o refresh falha por falta de conexão lança NetworkError (não sessão expirada)', async () => {
    // Uma instabilidade de rede bem no meio do refresh não significa que
    // o token esteja realmente inválido — não deve derrubar a sessão nem
    // (em background sync) marcar "precisa logar de novo".
    const onAuthFailed = jest.fn();
    setAuthFailedHandler(onAuthFailed);
    mockedAuth.getRefreshToken.mockResolvedValue('refresh-token');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse(401, 'expirado'))
      .mockRejectedValueOnce(new TypeError('Network request failed'));

    const error = await apiRequest('/sessoes/abc').catch((e) => e);

    expect(error).toBeInstanceOf(NetworkError);
    expect(mockedAuth.clearAll).not.toHaveBeenCalled();
    expect(onAuthFailed).not.toHaveBeenCalled();
  });

  it('401 fora de /auth/ com isBackgroundSync quando o refresh falha por falta de conexão lança NetworkError (não SyncAuthExpiredError)', async () => {
    mockedAuth.getRefreshToken.mockResolvedValue('refresh-token');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse(401, 'expirado'))
      .mockRejectedValueOnce(new TypeError('Network request failed'));

    const error = await apiRequest('/sessoes/abc', { isBackgroundSync: true }).catch((e) => e);

    expect(error).toBeInstanceOf(NetworkError);
    expect(error).not.toBeInstanceOf(SyncAuthExpiredError);
  });

  it('401 seguido de refresh bem-sucedido reexecuta a request uma vez e retorna o resultado', async () => {
    mockedAuth.getRefreshToken.mockResolvedValue('refresh-token');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse(401, 'expirado'))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'novo-token',
          refresh_token: 'novo-refresh',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const result = await apiRequest<{ ok: boolean }>('/sessoes/abc');

    expect(result).toEqual({ ok: true });
    expect(mockedAuth.setAccessToken).toHaveBeenCalledWith('novo-token');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
