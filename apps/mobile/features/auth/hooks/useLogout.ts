import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { apiRequest } from '@/shared/lib/api-client';
import { clearAll, getRefreshToken } from '@/shared/lib/auth';

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
      await clearAll();
      queryClient.clear();
      router.replace('/(auth)/login');
    },
  });
}
