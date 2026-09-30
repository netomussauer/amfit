import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { SalvarFichaComoTemplateRequest, TemplateResponse } from '@amfit/shared';
import { fichaService } from '../services/ficha.service';
import { templateKeys } from './query-keys';

type Payload = { fichaId: string; body: SalvarFichaComoTemplateRequest };

export function useSalvarFichaComoTemplate() {
  const queryClient = useQueryClient();

  return useMutation<TemplateResponse, AxiosError, Payload>({
    mutationFn: ({ fichaId, body }) => fichaService.salvarComoTemplate(fichaId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}
