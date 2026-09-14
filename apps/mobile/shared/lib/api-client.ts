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
  /**
   * Marca uma chamada feita pelo motor de sincronização offline (fora de
   * uma ação interativa do usuário) — ver features/execucao/lib/
   * offlineSyncEngine.ts (Fase 5 do modo offline). Um 401 nessa condição
   * não deve disparar o logout global (clearAll + onAuthFailed): a fila
   * de ações pendentes fica intacta e só marca "precisa logar de novo"
   * (ver SyncAuthExpiredError abaixo), já que apagar sessão/cache por
   * causa de uma tentativa em segundo plano perderia um treino não
   * sincronizado sem o usuário nem saber.
   */
  isBackgroundSync?: boolean;
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

/**
 * Falha do `fetch()` em si (sem conectividade, DNS, timeout) — distinta
 * de `ApiError`, que representa uma resposta HTTP de verdade (mesmo que
 * de erro) vinda do servidor. Ver modo offline (Fase 4 do roadmap):
 * hooks de mutation usam esse tipo pra decidir se devem enfileirar uma
 * ação pra sincronizar depois em vez de tratar como falha definitiva.
 */
export class NetworkError extends Error {
  constructor() {
    super('Sem conexão com o servidor');
    this.name = 'NetworkError';
  }
}

/**
 * Sessão expirou (refresh token também inválido) durante uma tentativa
 * de sincronização em segundo plano (`isBackgroundSync: true`) — ver
 * offlineSyncEngine.ts (Fase 5). Diferente do 401 interativo normal
 * (que limpa tokens/cache e redireciona pro login), esse erro não
 * dispara nenhum efeito colateral — quem chamou decide o que fazer
 * (hoje: marcar a fila como "precisa logar de novo" e parar de tentar).
 */
export class SyncAuthExpiredError extends Error {
  constructor() {
    super('Sessão expirada durante sincronização em segundo plano');
    this.name = 'SyncAuthExpiredError';
  }
}

let onAuthFailed: (() => void) | null = null;

export function setAuthFailedHandler(handler: (() => void) | null): void {
  onAuthFailed = handler;
}

type RefreshOutcome = 'refreshed' | 'invalid' | 'network-error';

let refreshPromise: Promise<RefreshOutcome> | null = null;

async function performRefresh(): Promise<RefreshOutcome> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return 'invalid';

      // Só a chamada de fetch() em si distingue "sem conectividade" de
      // "token realmente inválido" — sem essa distinção (o código antigo
      // tratava as duas igual, como falha de refresh), uma instabilidade
      // de rede bem no meio de um refresh seria lida como sessão
      // expirada de verdade: derrubaria a sessão no fluxo interativo
      // (clearAll + logout por causa de um soluço de conexão) e, desde a
      // Fase 5 do modo offline, travaria a fila de sync pra sempre (fica
      // marcada "precisa logar de novo" mesmo com credenciais válidas).
      let response: Response;
      try {
        response = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch {
        return 'network-error';
      }

      if (!response.ok) return 'invalid';

      const data = (await response.json()) as RefreshResponse;
      await setAccessToken(data.access_token);
      if (data.refresh_token) {
        await setRefreshToken(data.refresh_token);
      }
      return 'refreshed';
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
  const {
    method = 'GET',
    body,
    params,
    isMultipart = false,
    _retry = false,
    isBackgroundSync = false,
  } = options;

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

  // Só a chamada de fetch() em si entra no try/catch — uma resposta HTTP
  // de erro (4xx/5xx) resolve fetch() normalmente e precisa continuar
  // virando ApiError mais abaixo, não NetworkError.
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: requestBody,
    });
  } catch {
    throw new NetworkError();
  }

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
      const refreshResult = await performRefresh();
      if (refreshResult === 'refreshed') {
        return apiRequest<T>(path, { ...options, _retry: true });
      }
      if (refreshResult === 'network-error') {
        // Não conseguimos nem tentar o refresh (sem conectividade) — não
        // é sessão expirada de verdade, é falta de conexão. Não faz
        // sentido derrubar a sessão (fluxo interativo) nem marcar
        // "precisa logar de novo" (sync em segundo plano) por causa
        // disso; quem chamou já sabe lidar com NetworkError.
        throw new NetworkError();
      }
    }

    if (isBackgroundSync) {
      throw new SyncAuthExpiredError();
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
