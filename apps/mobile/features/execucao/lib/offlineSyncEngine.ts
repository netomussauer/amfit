import type { QueryClient } from '@tanstack/react-query';
import { onlineManager } from '@tanstack/react-query';
import type { SessaoResponse } from '@amfit/shared';
import { NetworkError, SyncAuthExpiredError } from '@/shared/lib/api-client';
import { execucaoService } from '../services/execucao.service';
import { sessaoKeys } from '../hooks/query-keys';
import * as offlineQueue from './offlineQueue';
import type { RegistrarItem } from './offlineQueue';
import { mergeSerieIntoSessao } from './mergeSerieIntoSessao';

let isDraining = false;

function mergeRegistroIntoCache(
  queryClient: QueryClient,
  sessaoId: string,
  registro: Awaited<ReturnType<typeof execucaoService.registrarSerie>>,
): void {
  const current = queryClient.getQueryData<SessaoResponse>(sessaoKeys.detail(sessaoId));
  if (!current) return;
  queryClient.setQueryData<SessaoResponse>(
    sessaoKeys.detail(sessaoId),
    mergeSerieIntoSessao(current, registro),
  );
}

async function processItem(
  queryClient: QueryClient,
  item: RegistrarItem,
): Promise<void> {
  const registro = await execucaoService.registrarSerie(item.sessaoRef, item.payload, {
    isBackgroundSync: true,
  });
  mergeRegistroIntoCache(queryClient, item.sessaoRef, registro);
  await offlineQueue.dequeue(item.id);
}

/**
 * Drena a fila offline em ordem FIFO. Só sabe processar `registrar_serie`
 * nesta fase (Fase 2 do modo offline) — `iniciar_sessao`/`concluir_sessao`
 * entram nas Fases 3-4, quando também passarem a ser enfileirados.
 *
 * Numa NetworkError (conexão caiu de novo no meio do drain), para e deixa
 * o resto na fila pra próxima tentativa. Numa ApiError de verdade (4xx/5xx
 * definitivo), descarta o item com aviso — sem reconciliação de conflito
 * nesta v1 (as mutations offline são, por desenho, quase sempre válidas;
 * validação client-side já cobre os casos de negócio comuns).
 */
export async function runDrain(queryClient: QueryClient): Promise<void> {
  if (isDraining || !onlineManager.isOnline()) return;
  isDraining = true;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const items = await offlineQueue.getAll();
      const item = items[0];
      if (!item) break;

      if (item.type !== 'registrar_serie') {
        // Ainda não implementado nesta fase — não deveria existir na fila
        // ainda (nada enfileira iniciar_sessao/concluir_sessao até as
        // Fases 3-4), mas por segurança não trava o drain nem descarta:
        // simplesmente para aqui.
        break;
      }

      try {
        await processItem(queryClient, item);
      } catch (err) {
        if (err instanceof NetworkError) {
          return;
        }
        if (err instanceof SyncAuthExpiredError) {
          await offlineQueue.setNeedsReauth(true);
          return;
        }
        // Sem UI ainda pra mostrar um histórico de itens descartados (só
        // Fase 4+) — gravar em `updateItem` antes de desenfileirar seria
        // trabalho morto, já que o dequeue a seguir apaga o registro
        // imediatamente. O console.warn é o único rastro por enquanto.
        console.warn('[offlineSyncEngine] descartando item da fila offline', item, err);
        await offlineQueue.dequeue(item.id);
      }
    }
  } finally {
    isDraining = false;
  }
}
