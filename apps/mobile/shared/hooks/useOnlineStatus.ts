import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

/**
 * Status de conectividade atual, alimentado pelo NetInfo via
 * shared/lib/offline-sync.ts (configureOfflineSync, chamado uma vez na
 * raiz do app). Wrapper fino sobre o onlineManager do React Query — ele
 * já é a fonte de verdade que as queries/mutations usam internamente,
 * então reaproveitar em vez de manter um segundo estado evita os dois
 * ficarem dessincronizados.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    onlineManager.subscribe.bind(onlineManager),
    () => onlineManager.isOnline(),
    () => onlineManager.isOnline(),
  );
}
