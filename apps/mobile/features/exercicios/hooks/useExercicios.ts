import { useQuery } from '@tanstack/react-query';
import {
  exercicioService,
  type ListarExerciciosParams,
} from '../services/exercicio.service';
import { exercicioKeys } from './query-keys';

export function useExercicios(params: ListarExerciciosParams = {}) {
  return useQuery({
    queryKey: exercicioKeys.list(params),
    queryFn: () => exercicioService.list(params),
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}
