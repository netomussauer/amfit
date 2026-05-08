import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';

type Variables = {
  fichaId: string;
  itemId: string;
};

export function useRemoverItem() {
  const queryClient = useQueryClient();

  return useMutation<void, AxiosError, Variables>({
    mutationFn: ({ itemId }) => fichaService.deleteItem(itemId),
    onSuccess: (_data, { fichaId }) => {
      queryClient.invalidateQueries({ queryKey: fichaKeys.detail(fichaId) });
    },
  });
}
