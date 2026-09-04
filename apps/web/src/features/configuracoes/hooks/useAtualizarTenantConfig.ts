import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import type { AtualizarTenantConfigRequest, TenantConfigResponse } from '@amfit/shared';
import { tenantService } from '../services/tenant.service';
import { tenantKeys } from './query-keys';

type Vars = { payload: AtualizarTenantConfigRequest; logo: File | null };

export function useAtualizarTenantConfig() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<TenantConfigResponse, AxiosError, Vars>({
    mutationFn: ({ payload, logo }) => tenantService.atualizarConfig(payload, logo),
    onSuccess: (data) => {
      queryClient.setQueryData(tenantKeys.me(), data);
      // As CSS vars são injetadas no <html> pelo layout raiz — um Server
      // Component, avaliado por request. router.refresh() re-executa esse
      // Server Component sem descartar o estado do client (diferente de um
      // reload completo), então as novas cores aparecem imediatamente.
      router.refresh();
    },
  });
}
