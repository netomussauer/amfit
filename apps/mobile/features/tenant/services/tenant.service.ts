import { TenantConfigResponseSchema, type TenantConfigResponse } from '@amfit/shared';
import { apiRequest } from '@/shared/lib/api-client';

export const tenantService = {
  async getMinhaConfig(): Promise<TenantConfigResponse> {
    const data = await apiRequest<unknown>('/tenants/me/config');
    return TenantConfigResponseSchema.parse(data);
  },

  /**
   * Branding público do personal dono do código de convite (antes do login).
   * Código inexistente/malformado responde 404 (ApiError). O chamador deve
   * passar o código já normalizado (maiúsculas, 8 caracteres).
   */
  async getConfigPublica(codigo: string): Promise<TenantConfigResponse> {
    const data = await apiRequest<unknown>(`/public/tenants/${codigo}/config`);
    return TenantConfigResponseSchema.parse(data);
  },
};
