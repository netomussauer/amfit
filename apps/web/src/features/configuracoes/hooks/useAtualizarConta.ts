import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { AtualizarPersonalRequest, PersonalResponse } from '@amfit/shared';
import { personalService } from '../services/personal.service';
import { personalKeys } from './query-keys';

export function useAtualizarConta() {
  const queryClient = useQueryClient();

  return useMutation<PersonalResponse, AxiosError, AtualizarPersonalRequest>({
    mutationFn: (payload) => personalService.atualizarMinhaConta(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(personalKeys.me(), data);
    },
  });
}
