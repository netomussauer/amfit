import { useMutation, useQueryClient } from '@tanstack/react-query';
import { execucaoService } from '../services/execucao.service';
import { sessaoKeys, minhasSessoesKeys } from './query-keys';
import { treinoKeys } from '@/features/treino/hooks/query-keys';

export function useConcluirSessao(sessaoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => execucaoService.concluir(sessaoId),
    onSuccess: (sessao) => {
      queryClient.setQueryData(sessaoKeys.detail(sessaoId), sessao);
      queryClient.invalidateQueries({ queryKey: treinoKeys.hoje() });
      queryClient.invalidateQueries({ queryKey: minhasSessoesKeys.all });
    },
  });
}
