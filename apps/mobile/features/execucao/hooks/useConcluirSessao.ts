import { useMutation, useQueryClient, onlineManager } from '@tanstack/react-query';
import { SESSAO_STATUS, type SessaoResponse } from '@amfit/shared';
import { NetworkError } from '@/shared/lib/api-client';
import { execucaoService } from '../services/execucao.service';
import { sessaoKeys, minhasSessoesKeys } from './query-keys';
import { treinoKeys } from '@/features/treino/hooks/query-keys';
import * as offlineQueue from '../lib/offlineQueue';
import { runDrain } from '../lib/offlineSyncEngine';
import { isLocalSessaoId } from '../lib/localSessaoId';

export function useConcluirSessao(sessaoId: string) {
  const queryClient = useQueryClient();

  return useMutation<SessaoResponse, Error, void>({
    // Mesmo motivo das Fases 2-3: sem 'always' o React Query pausa a
    // mutation sozinho quando offline, e o mutationFn abaixo nunca
    // chegaria a rodar pra fazer o enfileiramento.
    networkMode: 'always',
    // Offline (ou conexão caindo no meio da chamada — NetworkError):
    // enfileira um `concluir_sessao` e resolve com uma versão otimista da
    // sessão já em cache (`status: CONCLUIDO`). Funciona igual estando
    // `sessaoId` local (ainda não sincronizado desde a Fase 3) ou real —
    // um `concluir_sessao` enfileirado sob um ID local já é reescrito
    // pelo `rewriteSessaoRef` existente quando o `iniciar_sessao`
    // correspondente sincronizar.
    //
    // Um ID local nunca existe no servidor, mesmo estando online agora
    // (a sessão em si ainda não sincronizou) — tentar a chamada real
    // contra `/sessoes/local-xxx/concluir` daria um 404 genérico em vez
    // de enfileirar, então esse caso sempre cai direto pro enfileiramento
    // independente de `onlineManager.isOnline()`.
    mutationFn: async () => {
      if (onlineManager.isOnline() && !isLocalSessaoId(sessaoId)) {
        try {
          return await execucaoService.concluir(sessaoId);
        } catch (err) {
          if (!(err instanceof NetworkError)) throw err;
        }
      }

      const current = queryClient.getQueryData<SessaoResponse>(sessaoKeys.detail(sessaoId));
      if (!current) {
        throw new Error('Sessão não encontrada em cache para concluir offline');
      }

      await offlineQueue.enqueue({ type: 'concluir_sessao', sessaoRef: sessaoId });
      void runDrain(queryClient);

      return { ...current, status: SESSAO_STATUS.CONCLUIDO, concluido_em: new Date().toISOString() };
    },
    onSuccess: (sessao) => {
      queryClient.setQueryData(sessaoKeys.detail(sessaoId), sessao);
      queryClient.invalidateQueries({ queryKey: treinoKeys.hoje() });
      queryClient.invalidateQueries({ queryKey: minhasSessoesKeys.all });
    },
  });
}
