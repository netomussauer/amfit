import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { CriarFichaRequest, FichaResponse } from '@amfit/shared';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';

export function useCriarFicha() {
  const queryClient = useQueryClient();

  return useMutation<FichaResponse, AxiosError, CriarFichaRequest>({
    mutationFn: (payload) => fichaService.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: fichaKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: fichaKeys.byAluno(data.aluno_id),
      });
      queryClient.setQueryData(fichaKeys.detail(data.id), data);
    },
  });
}
