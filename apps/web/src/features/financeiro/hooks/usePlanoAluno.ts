import { useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import type { PlanoResponse } from '@amfit/shared';
import { financeiroService } from '../services/financeiro.service';
import { financeiroKeys } from './query-keys';

export function usePlanoAluno(alunoId: string | undefined) {
  return useQuery<PlanoResponse, AxiosError>({
    queryKey: financeiroKeys.plano(alunoId ?? ''),
    queryFn: () => {
      if (!alunoId) throw new Error('alunoId obrigatório');
      return financeiroService.getPlano(alunoId);
    },
    enabled: !!alunoId,
    staleTime: 60 * 1000,
    // Não retentar 404 (aluno ainda não tem plano configurado) — é um
    // estado esperado, não um erro transiente (mesmo padrão de useAnamnese).
    retry: (failureCount, error) => {
      if (error.response?.status === 404) return false;
      return failureCount < 1;
    },
  });
}
