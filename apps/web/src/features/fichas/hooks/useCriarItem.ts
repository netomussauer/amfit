import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { CriarItemTreinoRequest, ItemTreinoResponse } from '@amfit/shared';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';

type Variables = {
  fichaId: string;
  treinoId: string;
  payload: CriarItemTreinoRequest;
};

export function useCriarItem() {
  const queryClient = useQueryClient();

  return useMutation<ItemTreinoResponse, AxiosError, Variables>({
    mutationFn: ({ treinoId, payload }) =>
      fichaService.createItem(treinoId, payload),
    onSuccess: (_data, { fichaId }) => {
      queryClient.invalidateQueries({ queryKey: fichaKeys.detail(fichaId) });
    },
  });
}
