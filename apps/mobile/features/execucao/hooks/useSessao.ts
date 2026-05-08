import { useQuery } from '@tanstack/react-query';
import { execucaoService } from '../services/execucao.service';
import { sessaoKeys } from './query-keys';

export function useSessao(sessaoId: string | undefined) {
  return useQuery({
    queryKey: sessaoId ? sessaoKeys.detail(sessaoId) : sessaoKeys.all,
    queryFn: () => execucaoService.buscar(sessaoId as string),
    enabled: typeof sessaoId === 'string' && sessaoId.length > 0,
    // Sessão ativa é altamente mutável — evita refetch agressivo durante o treino,
    // mas permite refresh manual via invalidate.
    staleTime: 30 * 1000,
  });
}
