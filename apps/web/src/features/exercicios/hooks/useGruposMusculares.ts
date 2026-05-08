import { useQuery } from '@tanstack/react-query';
import type { GrupoMuscular } from '@amfit/shared';
import { exercicioService } from '../services/exercicio.service';
import { exercicioKeys } from './query-keys';

export function useGruposMusculares() {
  return useQuery<GrupoMuscular[]>({
    queryKey: exercicioKeys.grupos(),
    queryFn: () => exercicioService.listGrupos(),
    staleTime: 60 * 60 * 1000, // 1h — raramente muda
  });
}
