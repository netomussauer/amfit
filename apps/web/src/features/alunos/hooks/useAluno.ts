import { useQuery } from '@tanstack/react-query';
import type { AlunoResponse } from '@amfit/shared';
import { alunoService } from '../services/aluno.service';
import { alunoKeys } from './query-keys';

export function useAluno(id: string | undefined) {
  return useQuery<AlunoResponse>({
    queryKey: alunoKeys.detail(id ?? ''),
    queryFn: () => {
      if (!id) throw new Error('id obrigatório');
      return alunoService.getById(id);
    },
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}
