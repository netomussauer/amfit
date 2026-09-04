import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/shared/lib/api-client';
import { financeiroService } from '../services/financeiro.service';
import { financeiroKeys } from './query-keys';

export function useMeuPlano() {
  return useQuery({
    queryKey: financeiroKeys.plano(),
    queryFn: () => financeiroService.getMeuPlano(),
    staleTime: 60 * 1000,
    // Não retentar 404 (aluno ainda não tem plano configurado pelo
    // personal) — é um estado esperado, não um erro transiente.
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 1;
    },
  });
}
