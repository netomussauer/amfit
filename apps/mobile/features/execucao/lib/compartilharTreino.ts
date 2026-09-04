import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

/**
 * Captura o <ShareCard> (offscreen, via `cardRef`) como PNG. Geração 100%
 * client-side (SDD §20.3) — sem custo de servidor, sem endpoint novo.
 *
 * Separado de `abrirShareSheet` de propósito: a captura é rápida e é a
 * parte que faz sentido cobrir com um loading state na UI; o share sheet
 * nativo (chamado depois, sem esperar) pode ficar aberto por tempo
 * indefinido — não deve travar nenhum indicador de "carregando".
 *
 * Nunca lança — retorna `null` em caso de falha (ref não montada, erro na
 * captura), só logada.
 */
export async function capturarCardTreino(
  cardRef: RefObject<View>,
): Promise<string | null> {
  try {
    if (!cardRef.current) return null;
    return await captureRef(cardRef, { format: 'png', quality: 1 });
  } catch (err) {
    console.warn('[share] falha ao capturar card de treino', err);
    return null;
  }
}

/**
 * Abre o share sheet nativo do SO para o PNG em `uri` (gerado por
 * `capturarCardTreino`). Fire-and-forget — o caller não deveria aguardar
 * essa promise pra atualizar loading state (ver comentário acima).
 *
 * Nunca lança — sem app de destino, usuário cancelando etc. só é logado.
 */
export async function abrirShareSheet(uri: string): Promise<void> {
  try {
    const disponivel = await Sharing.isAvailableAsync();
    if (!disponivel) {
      console.warn('[share] Sharing.isAvailableAsync() = false neste device');
      return;
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Compartilhar treino',
    });
  } catch (err) {
    console.warn('[share] falha ao compartilhar treino concluído', err);
  }
}
