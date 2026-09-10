import { useQuery } from '@tanstack/react-query';
import { sessaoIdResolutionKeys } from './query-keys';

/**
 * Observa a resolução de um ID local de sessão pro ID real — nunca busca
 * nada sozinho (`enabled: false`); só reflete o que `offlineSyncEngine`
 * grava via `setQueryData` quando o `iniciar_sessao` correspondente
 * sincroniza. A tela do player usa isso pra se redirecionar sozinha se
 * ainda estiver montada em `/treino/<id-local>` quando a sincronização
 * acontecer.
 */
export function useSessaoIdResolution(localId: string | null) {
  return useQuery<string>({
    queryKey: sessaoIdResolutionKeys.detail(localId ?? '—'),
    queryFn: () => {
      throw new Error('useSessaoIdResolution não busca sozinho — só via setQueryData');
    },
    enabled: false,
  });
}
