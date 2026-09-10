import { useQuery } from '@tanstack/react-query';
import { execucaoService } from '../services/execucao.service';
import { sessaoKeys } from './query-keys';
import { isLocalSessaoId } from '../lib/localSessaoId';

export function useSessao(sessaoId: string | undefined) {
  return useQuery({
    queryKey: sessaoId ? sessaoKeys.detail(sessaoId) : sessaoKeys.all,
    queryFn: () => execucaoService.buscar(sessaoId as string),
    // Um ID local (sessão iniciada offline, ainda não sincronizada) nunca
    // existe no servidor — tentar buscá-lo só daria 404. A tela lê o que
    // já está no cache (posto lá por `useIniciarSessao` offline-aware).
    enabled:
      typeof sessaoId === 'string' && sessaoId.length > 0 && !isLocalSessaoId(sessaoId),
    // Sessão ativa é altamente mutável — evita refetch agressivo durante o treino,
    // mas permite refresh manual via invalidate.
    staleTime: 30 * 1000,
  });
}
