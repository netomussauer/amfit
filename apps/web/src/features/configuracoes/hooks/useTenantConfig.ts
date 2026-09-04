import { useQuery } from '@tanstack/react-query';
import type { TenantConfigResponse } from '@amfit/shared';
import { tenantService } from '../services/tenant.service';
import { tenantKeys } from './query-keys';

export function useTenantConfig() {
  return useQuery<TenantConfigResponse>({
    queryKey: tenantKeys.me(),
    queryFn: () => tenantService.getMinhaConfig(),
    staleTime: 60 * 1000,
  });
}
