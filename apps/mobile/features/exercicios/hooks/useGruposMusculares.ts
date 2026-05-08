import { useQuery } from '@tanstack/react-query';
import { exercicioService } from '../services/exercicio.service';
import { grupoMuscularKeys } from './query-keys';

export function useGruposMusculares() {
  return useQuery({
    queryKey: grupoMuscularKeys.list(),
    queryFn: () => exercicioService.listGrupos(),
    staleTime: 60 * 60 * 1000,
  });
}
