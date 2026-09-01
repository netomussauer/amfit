import { useQuery } from '@tanstack/react-query';
import type { SessaoListResponse } from '@amfit/shared';
import { meuHistoricoService } from '../services/meu-historico.service';
import { minhaSessaoKeys, type MinhasSessoesParams } from './query-keys';

export function useMinhasSessoes(params: MinhasSessoesParams) {
  return useQuery<SessaoListResponse>({
    queryKey: minhaSessaoKeys.list(params),
    queryFn: () => meuHistoricoService.listar(params),
    placeholderData: (prev) => prev,
    staleTime: 60 * 1000,
  });
}
