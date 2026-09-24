import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Query, QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { treinoKeys } from '@/features/treino/hooks/query-keys';
import {
  CACHE_MAX_AGE_MS,
  CACHE_SCHEMA_VERSION,
  PERSISTED_QUERY_ROOTS,
} from './query-persist-config';

// Persistência do cache do React Query em disco — deixa o app abrir
// offline (cold start) e faz uma sessão iniciada offline (ID `local-…`)
// sobreviver a fechar o app. Ver a Fase 6 do modo offline.

export { CACHE_MAX_AGE_MS, CACHE_SCHEMA_VERSION, PERSISTED_QUERY_ROOTS };

const STORAGE_KEY = 'amfit_rq_cache';

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: STORAGE_KEY,
});

/** Só as raízes da allowlist, e só queries que TÊM dado — não as que
 * estão com `status === 'success'` (o padrão do React Query). Um refetch
 * que falha (API fora do ar, offline) muda o status pra `error` mas
 * mantém o `data`; filtrar por status apagaria essa query do disco na
 * próxima gravação (ex.: ao registrar uma série offline), e o app não
 * abriria mais sem rede no cold start seguinte. Query sem dado (primeiro
 * fetch pendente ou falho) continua fora. */
export function shouldPersistQuery(query: Query): boolean {
  return (
    query.state.data !== undefined &&
    PERSISTED_QUERY_ROOTS.includes(String(query.queryKey[0]))
  );
}

export const persistOptions = {
  persister,
  maxAge: CACHE_MAX_AGE_MS,
  buster: CACHE_SCHEMA_VERSION,
  dehydrateOptions: {
    shouldDehydrateQuery: shouldPersistQuery,
    // Nenhuma mutation vai pro disco. O padrão do React Query grava toda
    // mutation pausada COM as variáveis — um login offline (networkMode
    // 'online' por padrão) deixaria e-mail e senha em texto puro no
    // AsyncStorage. A escrita offline tem fila própria (offlineQueue), que
    // não passa por aqui.
    shouldDehydrateMutation: () => false,
  },
};

/**
 * Apaga o cache persistido. Nunca lança: uma falha ao apagar não pode
 * impedir o logout.
 */
export async function limparCachePersistido(): Promise<void> {
  try {
    await persister.removeClient();
  } catch (err) {
    console.warn('[query-persist] falha ao apagar o cache persistido', err);
  }
}

/**
 * Esvazia o cache em memória E o do disco, juntos. Usar em todo lugar que
 * encerra ou troca a sessão em vez de chamar `queryClient.clear()` direto:
 * sem apagar o disco, o próximo usuário do aparelho veria treino/ficha do
 * anterior offline. O `clear()` sozinho já regrava o estado vazio, mas com
 * throttle — matar o app nessa janela deixaria os dados antigos no disco.
 */
export async function limparCache(queryClient: QueryClient): Promise<void> {
  queryClient.clear();
  await limparCachePersistido();
}

/**
 * `shouldPersistQuery` grava queries que têm dado mesmo com `status:
 * 'error'` (refetch offline falho). Restauradas assim, uma tela que olhe
 * `isError`/`error` antes de `data` mostraria erro em vez do treino em
 * cache, e o `error` voltaria do JSON sem ser um Error. Depois de
 * restaurar, volta essas queries pra `success` sem erro — o React Query
 * refaz o fetch sozinho quando o dado estiver velho.
 */
export function normalizarQueriesRestauradas(queryClient: QueryClient): void {
  for (const query of queryClient.getQueryCache().getAll()) {
    if (query.state.status === 'error' && query.state.data !== undefined) {
      query.setState({ status: 'success', error: null, fetchFailureCount: 0, fetchFailureReason: null });
    }
  }
}

function mesmoDiaLocal(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * O "treino de hoje" é específico do dia (qual treino da ficha cai hoje e
 * o `sessao_hoje_id`). Restaurado de ontem, mostraria o treino errado e um
 * "Continuar" apontando pra uma sessão de ontem — então, depois de
 * restaurar, descarta se não foi atualizado hoje. Sem dado, a home mostra o
 * estado de erro offline (melhor que um treino errado) e se corrige sozinha
 * ao reconectar. Ficha e sessões não têm esse problema (são acessadas por
 * id ou valem por vários dias).
 */
export function descartarTreinoHojeVencido(
  queryClient: QueryClient,
  agora: Date = new Date(),
): void {
  const state = queryClient.getQueryState(treinoKeys.hoje());
  if (!state?.dataUpdatedAt) return;
  if (!mesmoDiaLocal(new Date(state.dataUpdatedAt), agora)) {
    queryClient.removeQueries({ queryKey: treinoKeys.hoje(), exact: true });
  }
}
