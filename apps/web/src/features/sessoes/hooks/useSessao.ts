import { useQuery } from '@tanstack/react-query';
import type { SessaoResponse } from '@amfit/shared';
import { sessaoService } from '../services/sessao.service';
import { sessaoKeys } from './query-keys';

export function useSessao(id: string | undefined) {
  return useQuery<SessaoResponse>({
    queryKey: sessaoKeys.detail(id ?? ''),
    queryFn: () => {
      if (!id) throw new Error('id obrigatório');
      return sessaoService.getById(id);
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}
