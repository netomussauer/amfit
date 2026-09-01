import { useQuery } from '@tanstack/react-query';
import type { SessaoResponse } from '@amfit/shared';
import { meuHistoricoService } from '../services/meu-historico.service';
import { minhaSessaoKeys } from './query-keys';

export function useMinhaSessao(id: string | undefined) {
  return useQuery<SessaoResponse>({
    queryKey: minhaSessaoKeys.detail(id ?? ''),
    queryFn: () => {
      if (!id) throw new Error('id obrigatório');
      return meuHistoricoService.buscar(id);
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}
