import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';

type Variables = {
  fichaId: string;
  treinoId: string;
};

export function useRemoverTreino() {
  const queryClient = useQueryClient();

  return useMutation<void, AxiosError, Variables>({
    mutationFn: ({ treinoId }) => fichaService.deleteTreino(treinoId),
    onSuccess: (_data, { fichaId }) => {
      queryClient.invalidateQueries({ queryKey: fichaKeys.detail(fichaId) });
    },
  });
}
