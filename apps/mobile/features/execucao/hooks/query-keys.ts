export const sessaoKeys = {
  all: ['sessoes'] as const,
  detail: (id: string) => [...sessaoKeys.all, 'detail', id] as const,
};

/** Chave sintética (não corresponde a nenhum endpoint) — só serve pra
 * `offlineSyncEngine` avisar `useSessaoIdResolution` de que um ID local
 * de sessão virou um ID real, via `setQueryData`. Nunca é buscada de
 * verdade (ver `useSessaoIdResolution`, `enabled: false`). */
export const sessaoIdResolutionKeys = {
  detail: (localId: string) => ['sessao-id-resolution', localId] as const,
};

/** Valor sentinela gravado em `sessaoIdResolutionKeys` quando um
 * `iniciar_sessao` enfileirado falha em definitivo (ex.: treino
 * removido/inativado no servidor antes da sincronização) — sem isso, uma
 * tela ainda montada em `/treino/<id-local>` ficaria presa pra sempre
 * mostrando "Aguardando sincronizar...", já que o item já foi descartado
 * da fila e nada mais tentaria sincronizá-lo de novo. */
export const SESSAO_ID_RESOLUTION_FALHOU = '__sessao_id_resolution_falhou__';

export const minhasSessoesKeys = {
  all: ['minhas-sessoes'] as const,
  list: (page: number, perPage: number) =>
    [...minhasSessoesKeys.all, 'list', { page, perPage }] as const,
};
