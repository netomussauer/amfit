import { useQuery } from '@tanstack/react-query';
import type { AlunoListResponse } from '@amfit/shared';
import { alunoService } from '../services/aluno.service';
import { alunoKeys, type AlunoListParams } from './query-keys';

export function useAlunos(params: AlunoListParams) {
  return useQuery<AlunoListResponse>({
    queryKey: alunoKeys.list(params),
    queryFn: () => alunoService.list(params),
    placeholderData: (prev) => prev,
    staleTime: 60 * 1000,
  });
}
