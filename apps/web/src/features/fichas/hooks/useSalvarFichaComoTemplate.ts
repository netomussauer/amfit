import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { SalvarFichaComoTemplateRequest, TemplateResponse } from '@amfit/shared';
import { fichaService } from '../services/ficha.service';

type Payload = { fichaId: string; body: SalvarFichaComoTemplateRequest };

export function useSalvarFichaComoTemplate() {
  return useMutation<TemplateResponse, AxiosError, Payload>({
    mutationFn: ({ fichaId, body }) => fichaService.salvarComoTemplate(fichaId, body),
  });
}
