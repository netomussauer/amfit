import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { queryClient } from './query-client';
import { runDrain } from '@/features/execucao/lib/offlineSyncEngine';

/**
 * Liga o onlineManager do React Query ao NetInfo — sem isso, o
 * onlineManager fica sempre "online" (assume conectividade por padrão),
 * já que o React Query não sabe nada sobre o estado real de rede do
 * dispositivo sozinho. Também dispara a drenagem da fila offline sempre
 * que a conexão volta (e uma vez no boot, caso o app tenha reaberto já
 * online com itens de uma sessão anterior ainda na fila).
 *
 * Chamada uma vez em MODULE SCOPE de app/_layout.tsx (não dentro de um
 * useEffect) — precisa estar armada antes do primeiro render, senão uma
 * mutation disparada logo na abertura do app pode rodar antes do listener
 * saber que está offline.
 */
export function configureOfflineSync(): void {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      // isInternetReachable pode ser `null` logo após o app abrir (NetInfo
      // ainda não confirmou) — nesse caso tratamos como online (mesmo
      // otimismo do default do onlineManager) e deixamos o request de
      // verdade decidir via NetworkError se a conexão não tem internet.
      const online = Boolean(state.isConnected) && state.isInternetReachable !== false;
      setOnline(online);
      if (online) void runDrain(queryClient);
    });
  });

  void runDrain(queryClient);
}
