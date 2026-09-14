import { useSyncExternalStore } from 'react';
import * as offlineQueue from '../lib/offlineQueue';

/** Indica se a última tentativa de sincronizar a fila offline em segundo
 * plano bateu num 401 que nem o refresh token resolveu — o aluno precisa
 * logar de novo pra sincronizar o que ficou pendente. */
export function useNeedsReauth(): boolean {
  return useSyncExternalStore(
    offlineQueue.subscribe,
    offlineQueue.getSnapshotNeedsReauth,
    () => false,
  );
}
