import { useQuery } from '@tanstack/react-query';
import type { TemplateListResponse } from '@amfit/shared';
import { fichaService } from '../services/ficha.service';
import { templateKeys, type TemplateListParams } from './query-keys';

export function useTemplates(params: TemplateListParams = {}) {
  return useQuery<TemplateListResponse>({
    queryKey: templateKeys.list(params),
    queryFn: () => fichaService.listarTemplates(params),
    staleTime: 60 * 1000,
  });
}
