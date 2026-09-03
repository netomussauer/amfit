import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import type { AnamneseResponse, RegistrarAnamneseRequest } from '@amfit/shared';
import { anamneseService } from '../services/anamnese.service';
import { anamneseKeys } from './query-keys';

type Variables = {
  alunoId: string;
  payload: RegistrarAnamneseRequest;
};

export function useRegistrarAnamnese() {
  const queryClient = useQueryClient();

  return useMutation<AnamneseResponse, AxiosError, Variables>({
    mutationFn: ({ alunoId, payload }) => anamneseService.registrar(alunoId, payload),
    onSuccess: (data, { alunoId }) => {
      // A resposta do POST já traz o resultado mais atualizado (inclusive
      // a sugestão de template, que o GET não recalcula) — grava direto no
      // cache em vez de invalidar e esperar um novo GET.
      queryClient.setQueryData(anamneseKeys.detail(alunoId), data);
    },
  });
}
