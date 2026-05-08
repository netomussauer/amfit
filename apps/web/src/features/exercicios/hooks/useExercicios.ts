import { useQuery } from '@tanstack/react-query';
import type { ExercicioListResponse } from '@amfit/shared';
import { exercicioService } from '../services/exercicio.service';
import { exercicioKeys, type ExercicioListParams } from './query-keys';

export function useExercicios(params: ExercicioListParams) {
  return useQuery<ExercicioListResponse>({
    queryKey: exercicioKeys.list(params),
    queryFn: () => exercicioService.list(params),
    placeholderData: (prev) => prev,
    staleTime: 2 * 60 * 1000,
  });
}
