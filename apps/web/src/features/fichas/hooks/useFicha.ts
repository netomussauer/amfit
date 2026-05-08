import { useQuery } from '@tanstack/react-query';
import type { FichaResponse } from '@amfit/shared';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';

export function useFicha(id: string | undefined) {
  return useQuery<FichaResponse>({
    queryKey: fichaKeys.detail(id ?? ''),
    queryFn: () => {
      if (!id) throw new Error('id obrigatório');
      return fichaService.getById(id);
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}
