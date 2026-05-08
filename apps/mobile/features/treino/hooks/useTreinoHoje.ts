import { useQuery } from '@tanstack/react-query';
import { treinoService } from '../services/treino.service';
import { treinoKeys } from './query-keys';

export function useTreinoHoje() {
  return useQuery({
    queryKey: treinoKeys.hoje(),
    queryFn: () => treinoService.getTreinoHoje(),
    staleTime: 5 * 60 * 1000,
  });
}
