import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import type { SessaoResponse } from '@amfit/shared';
import { execucaoService } from '../services/execucao.service';
import { execucaoSessaoKeys, minhasSessoesKeys } from './query-keys';
import { treinoHojeKeys } from '@/features/meu-treino/hooks/query-keys';

export function useConcluirSessao(sessaoId: string) {
  const queryClient = useQueryClient();

  return useMutation<SessaoResponse, AxiosError>({
    mutationFn: () => execucaoService.concluir(sessaoId),
    onSuccess: (sessao) => {
      queryClient.setQueryData(execucaoSessaoKeys.detail(sessaoId), sessao);
      queryClient.invalidateQueries({ queryKey: treinoHojeKeys.hoje() });
      queryClient.invalidateQueries({ queryKey: minhasSessoesKeys.all });
    },
  });
}
