import { useQuery } from '@tanstack/react-query';
import type { MensalidadeListResponse } from '@amfit/shared';
import { financeiroService } from '../services/financeiro.service';
import { financeiroKeys, type MensalidadeListParams } from './query-keys';

export function useMensalidades(params: MensalidadeListParams) {
  return useQuery<MensalidadeListResponse>({
    queryKey: financeiroKeys.mensalidadeList(params),
    queryFn: () => financeiroService.listMensalidades(params),
    staleTime: 30 * 1000,
  });
}
