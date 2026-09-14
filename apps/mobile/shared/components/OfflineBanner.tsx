import { Text, View } from 'react-native';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { usePendingSyncCount } from '@/features/execucao/hooks/usePendingSyncCount';
import { useNeedsReauth } from '@/features/execucao/hooks/useNeedsReauth';
import { pluralizar } from '@/shared/lib/pluralize';

/**
 * Aviso discreto de "você está offline" + contagem de ações pendentes de
 * sincronizar. Não renderiza nada quando online e sem fila — pensado pra
 * ficar sempre montado no topo de uma tela (sem precisar de lógica
 * condicional no caller) e só aparecer quando faz sentido.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const pendingCount = usePendingSyncCount();
  const needsReauth = useNeedsReauth();

  if (isOnline && pendingCount === 0) return null;

  // needsReauth tem prioridade sobre online/offline/sincronizando — é a
  // única mensagem acionável (as outras se resolvem sozinhas quando a
  // conexão volta; essa exige o aluno logar de novo).
  const mensagem =
    needsReauth && pendingCount > 0
      ? `Entre novamente para sincronizar ${pendingCount} ${pluralizar(pendingCount, 'ação', 'ações')}`
      : !isOnline
        ? pendingCount > 0
          ? `Você está offline · ${pendingCount} ${pluralizar(pendingCount, 'ação pendente', 'ações pendentes')}`
          : 'Você está offline'
        : `Sincronizando ${pendingCount} ${pluralizar(pendingCount, 'ação', 'ações')}...`;

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
