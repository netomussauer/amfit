import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import type { SessaoResponse } from '@amfit/shared';
import { execucaoService } from '../services/execucao.service';
import { execucaoSessaoKeys } from './query-keys';
import { treinoHojeKeys } from '@/features/meu-treino/hooks/query-keys';

type IniciarVariables = {
  treino_id: string;
};

export function useIniciarSessao() {
  const queryClient = useQueryClient();

  return useMutation<SessaoResponse, AxiosError, IniciarVariables>({
    mutationFn: ({ treino_id }) => execucaoService.iniciar(treino_id),
    onSuccess: (sessao) => {
      // Pré-popula o cache da sessão para a próxima tela já abrir com dados.
      queryClient.setQueryData(execucaoSessaoKeys.detail(sessao.id), sessao);
      queryClient.invalidateQueries({ queryKey: treinoHojeKeys.hoje() });
    },
  });
}
