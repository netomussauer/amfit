import { useQuery } from '@tanstack/react-query';
import type { SessaoListResponse } from '@amfit/shared';
import { sessaoService } from '../services/sessao.service';
import { sessaoKeys, type SessoesPorAlunoParams } from './query-keys';

export function useSessoesPorAluno(params: SessoesPorAlunoParams) {
  return useQuery<SessaoListResponse>({
    queryKey: sessaoKeys.byAluno(params),
    queryFn: () => sessaoService.listByAluno(params),
    placeholderData: (prev) => prev,
    staleTime: 60 * 1000,
    enabled: !!params.alunoId,
  });
}
