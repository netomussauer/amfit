import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { MensalidadeResponse, MarcarPagaRequest } from '@amfit/shared';
import { financeiroService } from '../services/financeiro.service';
import { financeiroKeys } from './query-keys';

type Variables = {
  mensalidadeId: string;
  payload: MarcarPagaRequest;
};

export function useMarcarPaga() {
  const queryClient = useQueryClient();

  return useMutation<MensalidadeResponse, AxiosError, Variables>({
    mutationFn: ({ mensalidadeId, payload }) => financeiroService.marcarPaga(mensalidadeId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeiroKeys.mensalidades() });
      queryClient.invalidateQueries({ queryKey: financeiroKeys.dashboard() });
    },
  });
}
