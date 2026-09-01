import { useQuery } from '@tanstack/react-query';
import type { FichaListResponse } from '@amfit/shared';
import { fichaService } from '../services/ficha.service';
import { fichaKeys, type FichaListParams } from './query-keys';

export function useFichas(params: FichaListParams) {
  return useQuery<FichaListResponse>({
    queryKey: fichaKeys.list(params),
    queryFn: () => fichaService.list(params),
    placeholderData: (prev) => prev,
    staleTime: 60 * 1000,
  });
}
