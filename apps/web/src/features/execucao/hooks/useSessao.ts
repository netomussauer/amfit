import { useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import type { SessaoResponse } from '@amfit/shared';
import { execucaoService } from '../services/execucao.service';
import { execucaoSessaoKeys } from './query-keys';

export function useSessao(sessaoId: string | undefined) {
  return useQuery<SessaoResponse, AxiosError>({
    queryKey: sessaoId ? execucaoSessaoKeys.detail(sessaoId) : execucaoSessaoKeys.all,
    queryFn: () => execucaoService.buscar(sessaoId as string),
    enabled: typeof sessaoId === 'string' && sessaoId.length > 0,
    // Sessão ativa é altamente mutável — evita refetch agressivo durante o treino,
    // mas permite refresh manual via invalidate.
    staleTime: 30 * 1000,
  });
}
