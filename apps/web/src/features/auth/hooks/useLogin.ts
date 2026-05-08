import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  AuthResponseSchema,
  type AuthResponse,
  type LoginRequest,
} from '@amfit/shared';
import { apiClient } from '@/shared/lib/api-client';
import { setAccessToken, setRefreshToken } from '@/shared/lib/auth';

export function useLogin() {
  return useMutation<AuthResponse, AxiosError, LoginRequest>({
    mutationFn: async (payload) => {
      const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
      return AuthResponseSchema.parse(data);
    },
    onSuccess: (data) => {
      setAccessToken(data.access_token);
      setRefreshToken(data.refresh_token);
    },
  });
}
