import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { PlanoResponse, CriarPlanoRequest } from '@amfit/shared';
import { financeiroService } from '../services/financeiro.service';
import { financeiroKeys } from './query-keys';

type Variables = {
  alunoId: string;
  payload: CriarPlanoRequest;
};

export function useConfigurarPlano() {
  const queryClient = useQueryClient();

  return useMutation<PlanoResponse, AxiosError, Variables>({
    mutationFn: ({ alunoId, payload }) => financeiroService.configurarPlano(alunoId, payload),
    onSuccess: (data, { alunoId }) => {
      queryClient.setQueryData(financeiroKeys.plano(alunoId), data);
    },
  });
}
