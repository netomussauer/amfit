import { useQuery } from '@tanstack/react-query';
import type { DashboardFinanceiroResponse } from '@amfit/shared';
import { financeiroService } from '../services/financeiro.service';
import { financeiroKeys } from './query-keys';

export function useDashboardFinanceiro() {
  return useQuery<DashboardFinanceiroResponse>({
    queryKey: financeiroKeys.dashboard(),
    queryFn: () => financeiroService.getDashboard(),
    staleTime: 30 * 1000,
  });
}
