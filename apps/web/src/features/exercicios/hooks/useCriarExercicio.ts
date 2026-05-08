import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { CriarExercicioRequest, ExercicioResponse } from '@amfit/shared';
import { exercicioService } from '../services/exercicio.service';
import { exercicioKeys } from './query-keys';

type Variables = {
  data: CriarExercicioRequest;
  midia: File | null;
};

export function useCriarExercicio() {
  const queryClient = useQueryClient();

  return useMutation<ExercicioResponse, AxiosError, Variables>({
    mutationFn: ({ data, midia }) => exercicioService.create(data, midia),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exercicioKeys.lists() });
    },
  });
}
