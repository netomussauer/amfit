import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type {
  AtualizarItemTreinoRequest,
  ItemTreinoResponse,
} from '@amfit/shared';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';

type Variables = {
  fichaId: string;
  itemId: string;
  payload: AtualizarItemTreinoRequest;
};

export function useAtualizarItem() {
  const queryClient = useQueryClient();

  return useMutation<ItemTreinoResponse, AxiosError, Variables>({
    mutationFn: ({ itemId, payload }) =>
      fichaService.updateItem(itemId, payload),
    onSuccess: (_data, { fichaId }) => {
      queryClient.invalidateQueries({ queryKey: fichaKeys.detail(fichaId) });
    },
  });
}
