import { useQuery } from '@tanstack/react-query';
import type { HistoricoExercicioResponse } from '@amfit/shared';
import { progressoService } from '../services/progresso.service';
import { progressoKeys, type HistoricoExercicioParams } from './query-keys';

export function useHistoricoExercicio(params: HistoricoExercicioParams) {
  return useQuery<HistoricoExercicioResponse>({
    queryKey: progressoKeys.historico(params),
    queryFn: () => progressoService.getHistoricoExercicio(params),
    enabled: !!params.alunoId && !!params.exercicioId,
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });
}
