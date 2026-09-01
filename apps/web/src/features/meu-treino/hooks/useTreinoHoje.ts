import { useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import type { TreinoHojeResponse } from '@amfit/shared';
import { treinoService } from '../services/treino.service';
import { treinoHojeKeys } from './query-keys';

export function useTreinoHoje() {
  return useQuery<TreinoHojeResponse | null, AxiosError>({
    queryKey: treinoHojeKeys.hoje(),
    queryFn: () => treinoService.getTreinoHoje(),
    staleTime: 5 * 60 * 1000,
  });
}
