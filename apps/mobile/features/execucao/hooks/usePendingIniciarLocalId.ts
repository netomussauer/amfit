import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as offlineQueue from '../lib/offlineQueue';

/**
 * Se o aluno iniciou um treino offline, saiu da tela e voltou (ainda
 * offline, antes de sincronizar), `sessaoHojeId` vindo do servidor ainda
 * não sabe da sessão local — sem isso, a tela inicial voltaria a mostrar
 * "Iniciar Treino" e um segundo toque criaria uma SEGUNDA sessão local
 * pro mesmo treino do dia. Relê a fila persistida (não um ponteiro em
 * memória) a cada vez que a tela ganha foco, então sobrevive a
 * sair/voltar dentro da mesma sessão do app.
 */
export function usePendingIniciarLocalId(treinoId: string | undefined): string | null {
  const [localId, setLocalId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelado = false;

      if (!treinoId) {
        setLocalId(null);
        return;
      }

      void offlineQueue.getAll().then((items) => {
        if (cancelado) return;
        const pendente = items.find(
          (item) => item.type === 'iniciar_sessao' && item.payload.treino_id === treinoId,
        );
        setLocalId(pendente && pendente.type === 'iniciar_sessao' ? pendente.localSessaoId : null);
      });

      return () => {
        cancelado = true;
      };
    }, [treinoId]),
  );

  return localId;
}
