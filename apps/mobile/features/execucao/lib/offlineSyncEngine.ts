import type { QueryClient } from '@tanstack/react-query';
import { onlineManager } from '@tanstack/react-query';
import type { SessaoResponse } from '@amfit/shared';
import { NetworkError, SyncAuthExpiredError } from '@/shared/lib/api-client';
import { execucaoService } from '../services/execucao.service';
import { sessaoKeys, sessaoIdResolutionKeys, SESSAO_ID_RESOLUTION_FALHOU } from '../hooks/query-keys';
import { treinoKeys } from '@/features/treino/hooks/query-keys';
import * as offlineQueue from './offlineQueue';
import type { RegistrarItem, IniciarItem } from './offlineQueue';
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

async function processRegistrarItem(
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
 * Processa um `iniciar_sessao` enfileirado offline (Fase 3): cria a
 * sessão real no backend (idempotente — replay seguro), leva pro cache
 * dela qualquer série já registrada localmente sob o ID local (pra não
 * sumir progresso visível na troca), reescreve `sessaoRef` de outros
 * itens já enfileirados que apontavam pro ID local, e avisa a tela do
 * player (se ainda montada em `/treino/<id-local>`) via a query de
 * resolução, pra ela se redirecionar sozinha.
 */
async function processIniciarItem(queryClient: QueryClient, item: IniciarItem): Promise<void> {
  const sessaoReal = await execucaoService.iniciar(item.payload.treino_id, {
    isBackgroundSync: true,
  });
  const cacheLocal = queryClient.getQueryData<SessaoResponse>(
    sessaoKeys.detail(item.localSessaoId),
  );
  // `iniciar` é idempotente: se já existia uma sessão EM_ANDAMENTO pro dia
  // (de outro dispositivo, por exemplo), `sessaoReal.series` pode já vir
  // com séries reais — funde por chave natural em vez de simplesmente
  // preferir o cache local (que substituiria dados reais por nada, já
  // que uma sessão recém-criada offline sempre começa com `series: []`).
  const sessaoComSeries = (cacheLocal?.series ?? []).reduce(
    mergeSerieIntoSessao,
    sessaoReal,
  );
  queryClient.setQueryData<SessaoResponse>(sessaoKeys.detail(sessaoReal.id), sessaoComSeries);
  await offlineQueue.rewriteSessaoRef(item.localSessaoId, sessaoReal.id);
  queryClient.setQueryData(sessaoIdResolutionKeys.detail(item.localSessaoId), sessaoReal.id);
  queryClient.invalidateQueries({ queryKey: treinoKeys.hoje() });
  await offlineQueue.dequeue(item.id);
}

/**
 * Drena a fila offline em ordem FIFO. Processa `iniciar_sessao` e
 * `registrar_serie` (Fases 2-3) — `concluir_sessao` entra na Fase 4,
 * quando também passar a ser enfileirado.
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

      if (item.type === 'concluir_sessao') {
        // Ainda não implementado (Fase 4) — não deveria existir na fila
        // ainda, mas por segurança não trava o drain nem descarta:
        // simplesmente para aqui.
        break;
      }

      try {
        if (item.type === 'iniciar_sessao') {
          await processIniciarItem(queryClient, item);
        } else {
          await processRegistrarItem(queryClient, item);
        }
      } catch (err) {
        if (err instanceof NetworkError) {
          return;
        }
        if (err instanceof SyncAuthExpiredError) {
          await offlineQueue.setNeedsReauth(true);
          return;
        }
        if (item.type === 'iniciar_sessao') {
          // Sem isso, uma tela ainda montada em `/treino/<id-local>`
          // ficaria presa pra sempre em "Aguardando sincronizar..." — o
          // item já vai ser descartado da fila a seguir, então nada mais
          // tentaria sincronizá-lo de novo.
          queryClient.setQueryData(
            sessaoIdResolutionKeys.detail(item.localSessaoId),
            SESSAO_ID_RESOLUTION_FALHOU,
          );
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
