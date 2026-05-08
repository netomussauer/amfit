import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { AlunoResponse, AtualizarAlunoRequest } from '@amfit/shared';
import { alunoService } from '../services/aluno.service';
import { alunoKeys } from './query-keys';

type Variables = {
  id: string;
  payload: AtualizarAlunoRequest;
};

export function useAtualizarAluno() {
  const queryClient = useQueryClient();

  return useMutation<AlunoResponse, AxiosError, Variables>({
    mutationFn: ({ id, payload }) => alunoService.update(id, payload),
    onSuccess: (data, { id }) => {
      queryClient.setQueryData(alunoKeys.detail(id), data);
      queryClient.invalidateQueries({ queryKey: alunoKeys.lists() });
    },
  });
}
