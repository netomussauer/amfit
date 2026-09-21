import { useRef } from 'react';
import { Alert, type AlertButton } from 'react-native';
import { useRouter } from 'expo-router';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { useLogout } from './useLogout';
import { clearAll } from '@/shared/lib/auth';
import { pluralizar } from '@/shared/lib/pluralize';
import { limparCache } from '@/shared/lib/query-persist';
import * as offlineQueue from '@/features/execucao/lib/offlineQueue';

/**
 * Logout que pede confirmação quando há ações offline ainda não
 * sincronizadas — `useLogout` limpa a fila inteira (pra uma ação
 * enfileirada por um usuário não ser sincronizada na sessão de outro no
 * mesmo aparelho), então sair com pendências descarta esse treino pra
 * sempre. Sem pendências, sai direto, como antes.
 *
 * Lê a fila sob demanda (getPendingCount/getNeedsReauth), não o snapshot
 * em cache dos hooks de UI: o snapshot começa em 0 até a primeira leitura
 * do AsyncStorage terminar, e um logout logo após abrir o app pularia o
 * aviso justo quando há treino a perder.
 *
 * Pensado pro perfil do aluno (a dica de "Sincronizar agora" aponta pro
 * card que só existe lá).
 */
export function useConfirmarLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mutate: doLogout, isPending: isLoggingOut } = useLogout();
  // Marcado antes do primeiro await: impede que um toque duplo em "Sair"
  // empilhe dois diálogos (e rode o logout duas vezes ao confirmar).
  const ocupadoRef = useRef(false);

  // Mesmo efeito de um 401 interativo (tokens + cache de queries limpos,
  // volta pro login), mas SEM limpar a fila offline — o caminho pra quem
  // precisa reautenticar e não quer perder o que ainda não sincronizou.
  // useLogin limpa needsReauth e retoma a fila no próximo login.
  async function reautenticar() {
    await limparCache(queryClient);
    await clearAll();
    router.replace('/(auth)/login');
  }

  async function logout() {
    if (ocupadoRef.current || isLoggingOut) return;
    ocupadoRef.current = true;

    const pendingCount = await offlineQueue.getPendingCount();
    if (pendingCount === 0) {
      ocupadoRef.current = false;
      doLogout();
      return;
    }

    const needsReauth = await offlineQueue.getNeedsReauth();
    const liberar = () => {
      ocupadoRef.current = false;
    };
    const naoSincronizadas = `${pendingCount} ${pluralizar(
      pendingCount,
      'ação ainda não foi sincronizada',
      'ações ainda não foram sincronizadas',
    )}`;
    const perdidas = pluralizar(pendingCount, 'ela será perdida', 'elas serão perdidas');

    if (needsReauth) {
      const botoes: AlertButton[] = [
        { text: 'Cancelar', style: 'cancel', onPress: liberar },
        {
          text: 'Entrar novamente',
          onPress: () => {
            liberar();
            void reautenticar();
          },
        },
        {
          text: 'Sair e perder',
          style: 'destructive',
          onPress: () => {
            liberar();
            doLogout();
          },
        },
      ];
      Alert.alert(
        'Sessão expirada',
        `${naoSincronizadas} porque sua sessão expirou. Entre novamente para enviá-${pluralizar(pendingCount, 'la', 'las')}; se sair, ${perdidas}.`,
        botoes,
        { cancelable: true, onDismiss: liberar },
      );
      return;
    }

    const dica = onlineManager.isOnline()
      ? `\n\nToque em Cancelar e use "Sincronizar agora" para enviá-${pluralizar(pendingCount, 'la', 'las')} antes de sair.`
      : '';
    Alert.alert(
      'Sair com dados não sincronizados?',
      `${naoSincronizadas}. Se você sair agora, ${perdidas}.${dica}`,
      [
        { text: 'Cancelar', style: 'cancel', onPress: liberar },
        {
          text: 'Sair mesmo assim',
          style: 'destructive',
          onPress: () => {
            liberar();
            doLogout();
          },
        },
      ],
      { cancelable: true, onDismiss: liberar },
    );
  }

  return { logout, isLoggingOut };
}
