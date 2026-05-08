import { useMutation, useQueryClient } from '@tanstack/react-query';
import { exercicioService } from '../services/exercicio.service';
import { exercicioKeys } from './query-keys';

export function useDesativarExercicio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => exercicioService.desativar(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: exercicioKeys.lists() });
      queryClient.removeQueries({ queryKey: exercicioKeys.detail(id) });
    },
  });
}
