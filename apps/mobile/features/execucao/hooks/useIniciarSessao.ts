import { useMutation, useQueryClient } from '@tanstack/react-query';
import { execucaoService } from '../services/execucao.service';
import { sessaoKeys } from './query-keys';
import { treinoKeys } from '@/features/treino/hooks/query-keys';

type IniciarVariables = {
  treino_id: string;
};

export function useIniciarSessao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ treino_id }: IniciarVariables) =>
      execucaoService.iniciar(treino_id),
    onSuccess: (sessao) => {
      // Pré-popula o cache da sessão para a próxima tela já abrir com dados.
      queryClient.setQueryData(sessaoKeys.detail(sessao.id), sessao);
      queryClient.invalidateQueries({ queryKey: treinoKeys.hoje() });
    },
  });
}
