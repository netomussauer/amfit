import { TenantConfigResponseSchema, type TenantConfigResponse } from '@amfit/shared';
import { apiRequest } from '@/shared/lib/api-client';

export const tenantService = {
  async getMinhaConfig(): Promise<TenantConfigResponse> {
    const data = await apiRequest<unknown>('/tenants/me/config');
    return TenantConfigResponseSchema.parse(data);
  },
};
