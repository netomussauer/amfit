import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { AlterarSenhaRequest } from '@amfit/shared';
import { personalService } from '../services/personal.service';

export function useAlterarSenha() {
  return useMutation<void, AxiosError, AlterarSenhaRequest>({
    mutationFn: (payload) => personalService.alterarMinhaSenha(payload),
  });
}
