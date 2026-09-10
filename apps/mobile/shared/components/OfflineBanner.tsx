import { Text, View } from 'react-native';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { usePendingSyncCount } from '@/features/execucao/hooks/usePendingSyncCount';

/**
 * Aviso discreto de "você está offline" + contagem de ações pendentes de
 * sincronizar. Não renderiza nada quando online e sem fila — pensado pra
 * ficar sempre montado no topo de uma tela (sem precisar de lógica
 * condicional no caller) e só aparecer quando faz sentido.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const pendingCount = usePendingSyncCount();

  if (isOnline && pendingCount === 0) return null;

  const mensagem = !isOnline
    ? pendingCount > 0
      ? `Você está offline · ${pendingCount} ${pendingCount === 1 ? 'ação pendente' : 'ações pendentes'}`
      : 'Você está offline'
    : `Sincronizando ${pendingCount} ${pendingCount === 1 ? 'ação' : 'ações'}...`;

  return (
    <View
      className="bg-amber-50 px-4 py-2"
      accessibilityRole="alert"
      accessibilityLabel={mensagem}
    >
      <Text className="text-center text-xs font-medium text-amber-700">{mensagem}</Text>
    </View>
  );
}
