import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { exercicioService } from '../services/exercicio.service';
import { exercicioKeys } from './query-keys';

export function useDesativarExercicio() {
  const queryClient = useQueryClient();

  return useMutation<void, AxiosError, string>({
    mutationFn: (id) => exercicioService.delete(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: exercicioKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: exercicioKeys.lists() });
    },
  });
}
