import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { AlunoResponse, CriarAlunoRequest } from '@amfit/shared';
import { alunoService } from '../services/aluno.service';
import { alunoKeys } from './query-keys';

export function useCriarAluno() {
  const queryClient = useQueryClient();

  return useMutation<AlunoResponse, AxiosError, CriarAlunoRequest>({
    mutationFn: (payload) => alunoService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alunoKeys.lists() });
    },
  });
}
