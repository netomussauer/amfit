import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'amfit_access_token';
const REFRESH_TOKEN_KEY = 'amfit_refresh_token';

export type JwtPayload = {
  sub?: string;
  role?: string;
  tenant_id?: string;
  exp?: number;
  iat?: number;
  // Backend assina o claim padrao OIDC `name`. `nome` mantido como fallback
  // caso a convencao mude no futuro.
  name?: string;
  nome?: string;
};

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function setAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function removeAccessToken(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function removeRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearAll(): Promise<void> {
  await Promise.all([removeAccessToken(), removeRefreshToken()]);
}

export function parseJwt(token: string): JwtPayload | null {
  try {
    const base64 = token.split('.')[1];
    if (!base64) return null;
    const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    // atob devolve uma "binary string" (1 char = 1 byte); o payload é UTF-8,
    // então reinterpretamos os bytes via percent-encoding. Sem isso, nomes com
    // acento ("João") viram mojibake ("JoÃ£o"). Evita TextDecoder, que nem
    // todo runtime do React Native expõe.
    const binary = atob(padded);
    const json = decodeURIComponent(
      Array.from(binary, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<JwtPayload | null> {
  const token = await getAccessToken();
  if (!token) return null;
  return parseJwt(token);
}

export function getDisplayName(payload: JwtPayload | null | undefined): string | undefined {
  if (!payload) return undefined;
  return payload.name ?? payload.nome;
}
