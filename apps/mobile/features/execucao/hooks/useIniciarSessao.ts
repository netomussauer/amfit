import { useMutation, useQueryClient, onlineManager } from '@tanstack/react-query';
import type { SessaoResponse } from '@amfit/shared';
import { NetworkError } from '@/shared/lib/api-client';
import { execucaoService } from '../services/execucao.service';
import { sessaoKeys } from './query-keys';
import { treinoKeys } from '@/features/treino/hooks/query-keys';
import * as offlineQueue from '../lib/offlineQueue';
import { runDrain } from '../lib/offlineSyncEngine';
import { generateLocalSessaoId, buildPlaceholderSessao } from '../lib/localSessaoId';

type IniciarVariables = {
  treino_id: string;
};

export function useIniciarSessao() {
  const queryClient = useQueryClient();

  return useMutation<SessaoResponse, Error, IniciarVariables>({
    // Mesmo motivo do `useRegistrarSerie` (Fase 2): sem 'always' o React
    // Query pausa a mutation sozinho quando offline, e o mutationFn abaixo
    // nunca chegaria a rodar pra fazer o enfileiramento.
    networkMode: 'always',
    // Offline (ou conexão caindo no meio da chamada — NetworkError):
    // enfileira um `iniciar_sessao` e resolve com uma sessão placeholder
    // de ID local — a tela navega pra `/treino/local-xxx` normalmente e
    // nunca precisa saber que a sessão ainda não existe no servidor.
    mutationFn: async ({ treino_id }) => {
      if (onlineManager.isOnline()) {
        try {
          return await execucaoService.iniciar(treino_id);
        } catch (err) {
          if (!(err instanceof NetworkError)) throw err;
        }
      }

      const localSessaoId = generateLocalSessaoId();
      await offlineQueue.enqueue({
        type: 'iniciar_sessao',
        localSessaoId,
        payload: { treino_id },
      });
      void runDrain(queryClient);

      return buildPlaceholderSessao(localSessaoId, treino_id);
    },
    onSuccess: (sessao) => {
      // Pré-popula o cache da sessão para a próxima tela já abrir com dados.
      queryClient.setQueryData(sessaoKeys.detail(sessao.id), sessao);
      queryClient.invalidateQueries({ queryKey: treinoKeys.hoje() });
    },
  });
}
