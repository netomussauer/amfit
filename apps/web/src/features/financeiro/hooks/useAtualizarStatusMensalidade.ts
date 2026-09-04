import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { MensalidadeResponse, AtualizarStatusMensalidadeRequest } from '@amfit/shared';
import { financeiroService } from '../services/financeiro.service';
import { financeiroKeys } from './query-keys';

type Variables = {
  mensalidadeId: string;
  payload: AtualizarStatusMensalidadeRequest;
};

export function useAtualizarStatusMensalidade() {
  const queryClient = useQueryClient();

  return useMutation<MensalidadeResponse, AxiosError, Variables>({
    mutationFn: ({ mensalidadeId, payload }) =>
      financeiroService.atualizarStatusMensalidade(mensalidadeId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeiroKeys.mensalidades() });
      queryClient.invalidateQueries({ queryKey: financeiroKeys.dashboard() });
    },
  });
}
