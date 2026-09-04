import { useMutation } from '@tanstack/react-query';
import type { LoginRequest, AuthResponse } from '@amfit/shared';
import { apiRequest } from '@/shared/lib/api-client';
import { setAccessToken, setRefreshToken } from '@/shared/lib/auth';
import { registrarPushTokenExpo } from '@/features/notificacoes';

type LoginResponse = AuthResponse & { refresh_token: string };

export function useLogin() {
  return useMutation({
    mutationFn: (data: LoginRequest) =>
      apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: data }),
    onSuccess: async (data) => {
      await setAccessToken(data.access_token);
      if (data.refresh_token) {
        await setRefreshToken(data.refresh_token);
      }
      // Best-effort — nunca deve bloquear/quebrar o login (ver
      // registrarPushTokenExpo, que já engole os próprios erros).
      void registrarPushTokenExpo();
    },
  });
}
