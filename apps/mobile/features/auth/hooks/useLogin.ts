import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LoginRequest, AuthResponse } from '@amfit/shared';
import { apiRequest } from '@/shared/lib/api-client';
import { setAccessToken, setRefreshToken } from '@/shared/lib/auth';
import { registrarPushTokenExpo } from '@/features/notificacoes';
import { requestThemeRefresh } from '@/features/tenant';
import * as offlineQueue from '@/features/execucao/lib/offlineQueue';
import { runDrain } from '@/features/execucao/lib/offlineSyncEngine';

type LoginResponse = AuthResponse & { refresh_token: string };

export function useLogin() {
  const queryClient = useQueryClient();

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
      // Pede pro ThemeProvider (montado na raiz do app) buscar a marca do
      // personal de novo — sem isso, o primeiro login numa instalação
      // nova só mostraria o tema certo depois de reabrir o app.
      requestThemeRefresh();
      // Se uma sincronização em segundo plano tinha ficado presa
      // esperando o aluno logar de novo (ver offlineSyncEngine.runDrain),
      // credenciais novas destravam a fila — limpa a flag e retoma.
      await offlineQueue.setNeedsReauth(false);
      void runDrain(queryClient);
    },
  });
}
