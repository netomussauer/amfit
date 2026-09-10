import { useSyncExternalStore } from 'react';
import * as offlineQueue from '../lib/offlineQueue';

/** Quantidade de ações offline pendentes de sincronizar. */
export function usePendingSyncCount(): number {
  return useSyncExternalStore(
    offlineQueue.subscribe,
    offlineQueue.getSnapshotCount,
    () => 0,
  );
}
