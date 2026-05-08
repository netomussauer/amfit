import { useQuery } from '@tanstack/react-query';
import type { AlunoResponse } from '@amfit/shared';
import { apiRequest } from '@/shared/lib/api-client';

export const ALUNO_ME_QUERY_KEY = ['aluno', 'me'] as const;

export function useAlunoMe() {
  return useQuery({
    queryKey: ALUNO_ME_QUERY_KEY,
    queryFn: () => apiRequest<AlunoResponse>('/alunos/me'),
    staleTime: 5 * 60 * 1000,
  });
}
