import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { AtualizarTreinoRequest, TreinoResponse } from '@amfit/shared';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';

type Variables = {
  fichaId: string;
  treinoId: string;
  payload: AtualizarTreinoRequest;
};

export function useAtualizarTreino() {
  const queryClient = useQueryClient();

  return useMutation<TreinoResponse, AxiosError, Variables>({
    mutationFn: ({ treinoId, payload }) =>
      fichaService.updateTreino(treinoId, payload),
    onSuccess: (_data, { fichaId }) => {
      queryClient.invalidateQueries({ queryKey: fichaKeys.detail(fichaId) });
    },
  });
}
