import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { AuthResponse } from '@amfit/shared';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from './auth';

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// baseURL relativa: o servidor Next.js faz proxy de /api/v1/* para o backend
// via `rewrites()` no next.config.mjs. Isso mantem todas as chamadas do
// browser na mesma origem do web, evita CORS e nao precisa expor o backend
// diretamente ao cliente.
const API_BASE = '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Single in-flight refresh request to avoid stampedes when multiple
// concurrent calls receive 401 simultaneously.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
      const { data } = await axios.post<AuthResponse>(
        `${apiClient.defaults.baseURL}/auth/refresh`,
        { refresh_token: refreshToken },
        { headers: { 'Content-Type': 'application/json' } },
      );
      setAccessToken(data.access_token);
      setRefreshToken(data.refresh_token);
      return data.access_token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined;
    const status = error.response?.status;

    // Skip refresh logic for the refresh endpoint itself or already-retried requests.
    const isRefreshCall = original?.url?.includes('/auth/refresh');

    if (
      status === 401 &&
      original &&
      !original._retry &&
      !isRefreshCall &&
      typeof window !== 'undefined'
    ) {
      original._retry = true;

      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient.request(original);
      }

      // Refresh failed — purge tokens and bounce to login.
      clearTokens();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  },
);

