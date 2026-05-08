import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { CriarTreinoRequest, TreinoResponse } from '@amfit/shared';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';

type Variables = {
  fichaId: string;
  payload: CriarTreinoRequest;
};

export function useCriarTreino() {
  const queryClient = useQueryClient();

  return useMutation<TreinoResponse, AxiosError, Variables>({
    mutationFn: ({ fichaId, payload }) =>
      fichaService.createTreino(fichaId, payload),
    onSuccess: (_data, { fichaId }) => {
      queryClient.invalidateQueries({ queryKey: fichaKeys.detail(fichaId) });
    },
  });
}
