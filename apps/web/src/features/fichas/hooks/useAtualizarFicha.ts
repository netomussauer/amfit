import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { AtualizarFichaRequest, FichaResponse } from '@amfit/shared';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';

type Variables = {
  id: string;
  payload: AtualizarFichaRequest;
};

export function useAtualizarFicha() {
  const queryClient = useQueryClient();

  return useMutation<FichaResponse, AxiosError, Variables>({
    mutationFn: ({ id, payload }) => fichaService.update(id, payload),
    onSuccess: (data, { id }) => {
      queryClient.setQueryData(fichaKeys.detail(id), data);
      queryClient.invalidateQueries({ queryKey: fichaKeys.lists() });
    },
  });
}
