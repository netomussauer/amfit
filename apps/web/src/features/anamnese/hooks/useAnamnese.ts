import { useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import type { AnamneseResponse } from '@amfit/shared';
import { anamneseService } from '../services/anamnese.service';
import { anamneseKeys } from './query-keys';

export function useAnamnese(alunoId: string | undefined) {
  return useQuery<AnamneseResponse, AxiosError>({
    queryKey: anamneseKeys.detail(alunoId ?? ''),
    queryFn: () => {
      if (!alunoId) throw new Error('alunoId obrigatório');
      return anamneseService.getByAluno(alunoId);
    },
    enabled: !!alunoId,
    staleTime: 60 * 1000,
    // Não retentar 404 (aluno ainda não preencheu anamnese) — é um estado
    // esperado, não um erro transiente (mesmo padrão de useMinhaFicha).
    retry: (failureCount, error) => {
      if (error.response?.status === 404) return false;
      return failureCount < 1;
    },
  });
}
