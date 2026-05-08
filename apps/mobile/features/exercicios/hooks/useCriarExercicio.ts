import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  exercicioService,
  type CriarExercicioInput,
  type MidiaInput,
} from '../services/exercicio.service';
import { exercicioKeys } from './query-keys';

type CriarExercicioVariables = {
  data: CriarExercicioInput;
  midia: MidiaInput | null;
};

export function useCriarExercicio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data, midia }: CriarExercicioVariables) =>
      exercicioService.create(data, midia),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exercicioKeys.lists() });
    },
  });
}
