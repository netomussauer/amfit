import type { Role } from '@amfit/shared';

export const ACCESS_TOKEN_COOKIE = 'amfit_access_token';
export const REFRESH_TOKEN_KEY = 'amfit:refresh_token';

const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 15; // 15 minutos

type JwtPayload = {
  sub?: string;
  user_id?: string;
  id?: string;
  nome?: string;
  name?: string;
  role?: Role;
  exp?: number;
  iat?: number;
};

export type CurrentUser = {
  id: string;
  nome: string;
  role: Role;
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;

  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${ACCESS_TOKEN_COOKIE}=`));

  if (!match) return null;
  const value = match.substring(ACCESS_TOKEN_COOKIE.length + 1);
  return value.length > 0 ? decodeURIComponent(value) : null;
}

export function setAccessToken(token: string): void {
  if (!isBrowser()) return;

  const isSecure = window.location.protocol === 'https:';
  const parts = [
    `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${ACCESS_TOKEN_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ];
  if (isSecure) parts.push('Secure');

  document.cookie = parts.join('; ');
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearTokens(): void {
  if (!isBrowser()) return;

  document.cookie = `${ACCESS_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function parseJwt(token: string): JwtPayload | null {
  try {
    const segments = token.split('.');
    if (segments.length !== 3) return null;

    const payload = segments[1];
    if (!payload) return null;

    // base64url -> base64
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );

    const json =
      typeof atob === 'function'
        ? decodeURIComponent(
            atob(padded)
              .split('')
              .map((c) => `%${('00' + c.charCodeAt(0).toString(16)).slice(-2)}`)
              .join(''),
          )
        : Buffer.from(padded, 'base64').toString('utf-8');

    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function getCurrentUser(): CurrentUser | null {
  const token = getAccessToken();
  if (!token) return null;

  const payload = parseJwt(token);
  if (!payload) return null;

  const id = payload.user_id ?? payload.sub ?? payload.id;
  const nome = payload.nome ?? payload.name;
  const role = payload.role;

  if (!id || !nome || !role) return null;

  return { id, nome, role };
}

export function isTokenExpired(token: string): boolean {
  const payload = parseJwt(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  return payload.exp * 1000 < Date.now();
}
