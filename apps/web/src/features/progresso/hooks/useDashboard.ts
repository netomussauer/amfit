import { useQuery } from '@tanstack/react-query';
import type { DashboardResponse } from '@amfit/shared';
import { progressoService } from '../services/progresso.service';
import { progressoKeys } from './query-keys';

export function useDashboard() {
  return useQuery<DashboardResponse>({
    queryKey: progressoKeys.dashboard(),
    queryFn: () => progressoService.getDashboard(),
    staleTime: 2 * 60 * 1000,
  });
}
