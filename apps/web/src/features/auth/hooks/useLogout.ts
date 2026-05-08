import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api-client';
import { clearTokens } from '@/shared/lib/auth';

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return async function logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Best-effort: still clear local tokens even if the server call fails.
    } finally {
      clearTokens();
      queryClient.clear();
      router.replace('/login');
    }
  };
}
