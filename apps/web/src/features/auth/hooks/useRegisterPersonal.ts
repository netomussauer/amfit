import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  AuthResponseSchema,
  type AuthResponse,
  type RegisterPersonalRequest,
} from '@amfit/shared';
import { apiClient } from '@/shared/lib/api-client';
import { setAccessToken, setRefreshToken } from '@/shared/lib/auth';

export function useRegisterPersonal() {
  return useMutation<AuthResponse, AxiosError, RegisterPersonalRequest>({
    mutationFn: async (payload) => {
      const body = {
        ...payload,
        telefone: payload.telefone || undefined,
        cref: payload.cref || undefined,
      };
      const { data } = await apiClient.post<AuthResponse>(
        '/auth/register-personal',
        body,
      );
      return AuthResponseSchema.parse(data);
    },
    onSuccess: (data) => {
      setAccessToken(data.access_token);
      setRefreshToken(data.refresh_token);
    },
  });
}
