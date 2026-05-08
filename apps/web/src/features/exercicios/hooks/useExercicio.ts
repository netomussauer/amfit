import { useQuery } from '@tanstack/react-query';
import type { ExercicioResponse } from '@amfit/shared';
import { exercicioService } from '../services/exercicio.service';
import { exercicioKeys } from './query-keys';

export function useExercicio(id: string | undefined) {
  return useQuery<ExercicioResponse>({
    queryKey: exercicioKeys.detail(id ?? ''),
    queryFn: () => {
      if (!id) throw new Error('id obrigatório');
      return exercicioService.getById(id);
    },
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}
