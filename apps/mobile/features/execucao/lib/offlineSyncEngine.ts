import type { QueryClient } from '@tanstack/react-query';
import { onlineManager } from '@tanstack/react-query';
import type { SessaoResponse } from '@amfit/shared';
import { NetworkError, SyncAuthExpiredError } from '@/shared/lib/api-client';
import { execucaoService } from '../services/execucao.service';
import {
  sessaoKeys,
  sessaoIdResolutionKeys,
  SESSAO_ID_RESOLUTION_FALHOU,
  minhasSessoesKeys,
} from '../hooks/query-keys';
import { treinoKeys } from '@/features/treino/hooks/query-keys';
import * as offlineQueue from './offlineQueue';
import type { RegistrarItem, IniciarItem, ConcluirItem } from './offlineQueue';
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
 * Processa um `concluir_sessao` enfileirado offline (Fase 4): chama o
 * backend (idempotente — confirmado por
 * `TestConcluirSessao_ChamadaDuasVezes_NaoErra`), grava a sessão real no
 * cache e replica as mesmas invalidations do `onSuccess` interativo de
 * `useConcluirSessao`. Se `item.sessaoRef` ainda apontava pra um ID local
 * quando este item foi enfileirado, já chega aqui reescrito pro ID real
 * — `iniciar_sessao` sempre é processado antes na mesma fila FIFO.
 */
async function processConcluirItem(queryClient: QueryClient, item: ConcluirItem): Promise<void> {
  const sessaoConcluida = await execucaoService.concluir(item.sessaoRef, {
    isBackgroundSync: true,
  });
  queryClient.setQueryData(sessaoKeys.detail(item.sessaoRef), sessaoConcluida);
  queryClient.invalidateQueries({ queryKey: treinoKeys.hoje() });
  queryClient.invalidateQueries({ queryKey: minhasSessoesKeys.all });
  await offlineQueue.dequeue(item.id);
}

/**
 * Drena a fila offline em ordem FIFO. Processa `iniciar_sessao`,
 * `registrar_serie` e `concluir_sessao` (Fases 2-4).
 *
 * Numa NetworkError (conexão caiu de novo no meio do drain), para e deixa
 * o resto na fila pra próxima tentativa. Numa ApiError de verdade (4xx/5xx
 * definitivo), descarta o item com aviso — sem reconciliação de conflito
 * nesta v1 (as mutations offline são, por desenho, quase sempre válidas;
 * validação client-side já cobre os casos de negócio comuns).
 *
 * Se `needsReauth` já está marcado (uma tentativa anterior bateu num 401
 * que nem o refresh token resolveu), nem tenta — sem isso, toda
 * reconexão/novo item enfileirado dispara `runDrain` de novo (já é o
 * comportamento existente) e cada uma dessas chamadas gastaria uma
 * tentativa contra um refresh token que já sabemos estar morto, até o
 * aluno logar de novo (`useLogin` limpa a flag e retoma a fila).
 */
export async function runDrain(queryClient: QueryClient): Promise<void> {
  // getSnapshotNeedsReauth() (não getNeedsReauth()) de propósito — é o
  // mesmo cache síncrono já mantido em dia a cada escrita da fila (usado
  // por useNeedsReauth), então não vale a pena um round-trip a mais no
  // AsyncStorage só pra reler o que o cache já reflete corretamente.
  if (isDraining || !onlineManager.isOnline() || offlineQueue.getSnapshotNeedsReauth()) return;
  isDraining = true;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const items = await offlineQueue.getAll();
      const item = items[0];
      if (!item) break;

      try {
        if (item.type === 'iniciar_sessao') {
          await processIniciarItem(queryClient, item);
        } else if (item.type === 'concluir_sessao') {
          await processConcluirItem(queryClient, item);
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
