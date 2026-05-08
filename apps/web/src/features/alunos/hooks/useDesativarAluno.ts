import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { alunoService } from '../services/aluno.service';
import { alunoKeys } from './query-keys';

export function useDesativarAluno() {
  const queryClient = useQueryClient();

  return useMutation<void, AxiosError, string>({
    mutationFn: (id) => alunoService.deactivate(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: alunoKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: alunoKeys.lists() });
    },
  });
}
