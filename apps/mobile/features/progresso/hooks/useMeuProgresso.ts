import { useQuery } from '@tanstack/react-query';
import { progressoService, type HistoricoExercicioQueryParams } from '../services/progresso.service';
import { progressoKeys } from './query-keys';

export function useMeuProgresso(
  exercicioId: string | undefined,
  params?: HistoricoExercicioQueryParams,
) {
  return useQuery({
    queryKey: progressoKeys.exercicio(exercicioId ?? '', params),
    queryFn: () => {
      if (!exercicioId) throw new Error('exercicioId obrigatório');
      return progressoService.getMeuProgresso(exercicioId, params);
    },
    enabled: !!exercicioId,
    staleTime: 60 * 1000,
  });
}
