import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { PlanoResponse, AtualizarPlanoRequest } from '@amfit/shared';
import { financeiroService } from '../services/financeiro.service';
import { financeiroKeys } from './query-keys';

type Variables = {
  planoId: string;
  alunoId: string;
  payload: AtualizarPlanoRequest;
};

export function useAtualizarPlano() {
  const queryClient = useQueryClient();

  return useMutation<PlanoResponse, AxiosError, Variables>({
    mutationFn: ({ planoId, payload }) => financeiroService.atualizarPlano(planoId, payload),
    onSuccess: (data, { alunoId }) => {
      queryClient.setQueryData(financeiroKeys.plano(alunoId), data);
    },
  });
}
