import { useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import type { FichaResponse } from '@amfit/shared';
import { treinoService } from '../services/treino.service';
import { minhaFichaKeys } from './query-keys';

export function useMinhaFicha() {
  return useQuery<FichaResponse, AxiosError>({
    queryKey: minhaFichaKeys.ativa(),
    queryFn: () => treinoService.getMinhaFicha(),
    staleTime: 10 * 60 * 1000,
    // Não retentar 404 (sem ficha ativa) — é um estado esperado, não um erro transiente.
    retry: (failureCount, error) => {
      if (error.response?.status === 404) return false;
      return failureCount < 1;
    },
  });
}
