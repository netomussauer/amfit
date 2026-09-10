import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { apiRequest } from '@/shared/lib/api-client';
import { clearAll, getRefreshToken } from '@/shared/lib/auth';
import * as offlineQueue from '@/features/execucao/lib/offlineQueue';

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return;
      try {
        await apiRequest<void>('/auth/logout', {
          method: 'POST',
          body: { refresh_token: refreshToken },
        });
      } catch {
        // Mesmo se a chamada falhar, encerramos a sessão localmente.
      }
    },
    onSettled: async () => {
      // A fila offline não tem dono (chave única no AsyncStorage, sem
      // vínculo com o usuário logado) — sem isso, uma ação enfileirada
      // por um usuário poderia ser sincronizada depois na sessão de outro
      // usuário no mesmo aparelho.
      await offlineQueue.clear();
      await clearAll();
      queryClient.clear();
      router.replace('/(auth)/login');
    },
  });
}
