import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { TenantConfigResponse } from '@amfit/shared';
import { tenantService } from '../services/tenant.service';
import { tenantKeys } from './query-keys';

export function useRegenerarCodigoTenant() {
  const queryClient = useQueryClient();

  return useMutation<TenantConfigResponse, AxiosError, void>({
    mutationFn: () => tenantService.regenerarCodigo(),
    onSuccess: (data) => {
      queryClient.setQueryData(tenantKeys.me(), data);
    },
    // A troca pode ter sido gravada no servidor mesmo quando a resposta falha
    // (ex.: erro transitório na releitura). Rebuscar ao terminar mostra o
    // código realmente vigente em vez de deixar o portal com o antigo.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: tenantKeys.me() });
    },
  });
}
