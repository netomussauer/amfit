import { useQuery } from '@tanstack/react-query';
import type { HistoricoExercicioResponse } from '@amfit/shared';
import { meuProgressoService } from '../services/meu-progresso.service';
import { meuProgressoKeys, type MeuProgressoParams } from './query-keys';

export function useMeuProgresso(params: MeuProgressoParams) {
  return useQuery<HistoricoExercicioResponse>({
    queryKey: meuProgressoKeys.exercicio(params),
    queryFn: () => meuProgressoService.getMeuProgresso(params),
    enabled: !!params.exercicioId,
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });
}
