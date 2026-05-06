import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Token stored in memory (set via setAuthToken) or read from cookie on SSR
  const token = typeof window !== 'undefined' ? window.__amfit_token : undefined;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Clear token and redirect to login on 401
      window.__amfit_token = undefined;
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export function setAuthToken(token: string | undefined) {
  if (typeof window !== 'undefined') {
    window.__amfit_token = token;
  }
}

// Augment the Window interface to hold the in-memory token
declare global {
  interface Window {
    __amfit_token?: string;
  }
}
