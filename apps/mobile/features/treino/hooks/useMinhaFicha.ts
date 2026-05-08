import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/shared/lib/api-client';
import { treinoService } from '../services/treino.service';
import { fichaKeys } from './query-keys';

export function useMinhaFicha() {
  return useQuery({
    queryKey: fichaKeys.ativa(),
    queryFn: () => treinoService.getMinhaFicha(),
    staleTime: 10 * 60 * 1000,
    // Não retentar 404 (sem ficha ativa) — comportamento esperado.
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 1;
    },
  });
}
