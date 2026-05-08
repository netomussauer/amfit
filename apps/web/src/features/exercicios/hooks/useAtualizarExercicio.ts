import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type {
  AtualizarExercicioRequest,
  ExercicioResponse,
} from '@amfit/shared';
import { exercicioService } from '../services/exercicio.service';
import { exercicioKeys } from './query-keys';

type Variables = {
  id: string;
  payload: AtualizarExercicioRequest;
};

export function useAtualizarExercicio() {
  const queryClient = useQueryClient();

  return useMutation<ExercicioResponse, AxiosError, Variables>({
    mutationFn: ({ id, payload }) => exercicioService.update(id, payload),
    onSuccess: (data, { id }) => {
      queryClient.setQueryData(exercicioKeys.detail(id), data);
      queryClient.invalidateQueries({ queryKey: exercicioKeys.lists() });
    },
  });
}
