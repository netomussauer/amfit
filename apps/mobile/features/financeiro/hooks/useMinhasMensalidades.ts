import { useQuery } from '@tanstack/react-query';
import { financeiroService, type MinhasMensalidadesQueryParams } from '../services/financeiro.service';
import { financeiroKeys } from './query-keys';

export function useMinhasMensalidades(params?: MinhasMensalidadesQueryParams) {
  return useQuery({
    queryKey: financeiroKeys.mensalidades(params),
    queryFn: () => financeiroService.getMinhasMensalidades(params),
    staleTime: 60 * 1000,
  });
}
