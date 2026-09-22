import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { apiRequest } from '@/shared/lib/api-client';
import { clearAll, getRefreshToken } from '@/shared/lib/auth';
import { limparCache } from '@/shared/lib/query-persist';
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
      // A fila offline tem dono (offlineQueue.garantirDonoAtual), mas só
      // detecta a troca de usuário na próxima vez que a fila for usada
      // (enqueue/drain) — um logout explícito é a oportunidade de limpar
      // na hora, sem depender disso: um usuário saindo por vontade própria
      // não deveria deixar rastro nenhum pro próximo a logar.
      await offlineQueue.clear();
      // Cache (memória + disco) ANTES dos tokens: se o processo morrer
      // entre os dois passos, é melhor sobrar um login ainda válido (sem
      // cache, só refaz as buscas) do que sobrar o cache do usuário
      // anterior sem ninguém logado.
      await limparCache(queryClient);
      await clearAll();
      router.replace('/(auth)/login');
    },
  });
}
