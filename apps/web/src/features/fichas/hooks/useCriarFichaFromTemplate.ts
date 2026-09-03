import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { CriarFichaFromTemplateRequest, FichaResponse } from '@amfit/shared';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';

export function useCriarFichaFromTemplate() {
  const queryClient = useQueryClient();

  return useMutation<FichaResponse, AxiosError, CriarFichaFromTemplateRequest>({
    mutationFn: (payload) => fichaService.fromTemplate(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: fichaKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: fichaKeys.byAluno(data.aluno_id),
      });
      queryClient.setQueryData(fichaKeys.detail(data.id), data);
    },
  });
}
