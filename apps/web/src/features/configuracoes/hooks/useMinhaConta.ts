import { useQuery } from '@tanstack/react-query';
import type { PersonalResponse } from '@amfit/shared';
import { personalService } from '../services/personal.service';
import { personalKeys } from './query-keys';

export function useMinhaConta() {
  return useQuery<PersonalResponse>({
    queryKey: personalKeys.me(),
    queryFn: () => personalService.getMinhaConta(),
    staleTime: 60 * 1000,
  });
}
