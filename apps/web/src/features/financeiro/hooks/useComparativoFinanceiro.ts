import { useQuery } from '@tanstack/react-query';
import type { ComparativoFinanceiroResponse } from '@amfit/shared';
import { financeiroService } from '../services/financeiro.service';
import { financeiroKeys } from './query-keys';

/** @param meses quantidade de competências a comparar (a API aplica o default/teto). */
export function useComparativoFinanceiro(meses: number = 6) {
  return useQuery<ComparativoFinanceiroResponse>({
    queryKey: financeiroKeys.comparativo(meses),
    queryFn: () => financeiroService.getComparativo(meses),
    staleTime: 30 * 1000,
  });
}
