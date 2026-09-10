import {
  clearAll,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from './auth';

// O backend expõe todas as rotas sob /api/v1 (ver apps/api/cmd/server/main.go
// — `api := app.Group("/api/v1")`). O web resolve isso com uma baseURL
// relativa (`/api/v1`) porque o Next.js faz proxy; o app mobile bate direto
// no host da API (sem proxy no meio), então precisa desse prefixo aqui —
// faltava nesta linha desde sempre, e só um teste real contra o backend
// (não os testes com jest, que mockam apiRequest/fetch) expõe isso: toda
// chamada saía como http://host:porta/rota em vez de .../api/v1/rota,
// resultando em 404 silencioso — a UI de login mostrava isso como
// "e-mail ou senha inválidos" antes da distinção de erro abaixo existir.
const BASE_URL = `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080'}/api/v1`;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  isMultipart?: boolean;
  _retry?: boolean;
};

type RefreshResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let onAuthFailed: (() => void) | null = null;

export function setAuthFailedHandler(handler: (() => void) | null): void {
  onAuthFailed = handler;
}

let refreshPromise: Promise<boolean> | null = null;

async function performRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return false;

      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) return false;

      const data = (await response.json()) as RefreshResponse;
      await setAccessToken(data.access_token);
      if (data.refresh_token) {
        await setRefreshToken(data.refresh_token);
      }
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, params, isMultipart = false, _retry = false } = options;

  const token = await getAccessToken();

  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const headers: Record<string, string> = {};
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let requestBody: BodyInit | undefined;
  if (body !== undefined) {
    requestBody = isMultipart ? (body as BodyInit) : JSON.stringify(body);
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: requestBody,
  });

  if (response.status === 401) {
    const isAuthEndpoint = path.startsWith('/auth/');

    // Um 401 em /auth/login (senha errada) ou /auth/refresh (refresh token
    // expirado) é uma falha de CREDENCIAIS, não uma sessão que expirou no
    // meio do uso — não faz sentido tentar refresh nem disparar o
    // clearAll()/onAuthFailed() (logout global + redirect pra tela de
    // login), que é o que já está acontecendo com QUALQUER sessão ativa.
    // Esse fluxo era inalcançável até o /api/v1 ser corrigido acima (toda
    // chamada mobile dava 404 antes disso), por isso só foi notado agora.
    if (isAuthEndpoint) {
      const text = await response.text().catch(() => 'Erro desconhecido');
      throw new ApiError(401, text);
    }

    if (!_retry) {
      const refreshed = await performRefresh();
      if (refreshed) {
        return apiRequest<T>(path, { ...options, _retry: true });
      }
    }

    await clearAll();
    onAuthFailed?.();
    throw new ApiError(401, 'Sessão expirada. Faça login novamente.');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => 'Erro desconhecido');
    throw new ApiError(response.status, text);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// Re-exports para compatibilidade com código que ainda importa daqui.
export {
  getAccessToken as getStoredToken,
  setAccessToken as storeToken,
  removeAccessToken as removeToken,
} from './auth';
