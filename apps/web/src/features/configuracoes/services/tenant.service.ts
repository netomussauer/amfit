import {
  TenantConfigResponseSchema,
  type AtualizarTenantConfigRequest,
  type TenantConfigResponse,
} from '@amfit/shared';
import { apiClient } from '@/shared/lib/api-client';

export const tenantService = {
  async getMinhaConfig(): Promise<TenantConfigResponse> {
    const { data } = await apiClient.get('/tenants/me/config');
    return TenantConfigResponseSchema.parse(data);
  },

  async atualizarConfig(
    payload: AtualizarTenantConfigRequest,
    logo: File | null,
  ): Promise<TenantConfigResponse> {
    const fd = new FormData();
    if (payload.cor_primaria) fd.append('cor_primaria', payload.cor_primaria);
    if (payload.cor_secundaria) fd.append('cor_secundaria', payload.cor_secundaria);
    // !== undefined (não truthy) — nome_app='' é um valor válido e
    // intencional (limpar o campo, permitido pelo schema via
    // `.or(z.literal(''))`); um check de truthiness descartava esse caso
    // e o campo nunca podia voltar a ficar em branco (achado de
    // code-review).
    if (payload.nome_app !== undefined) fd.append('nome_app', payload.nome_app);
    if (logo) fd.append('logo', logo);

    // NUNCA fixar 'Content-Type: multipart/form-data' manualmente aqui —
    // axios (nesta versão) não sobrescreve o header pra FormData (só
    // reseta em transformRequest quando detecta JSON), então um valor fixo
    // vai sem boundary e o backend não consegue parsear o multipart
    // (achado de code-review: o mesmo bug já existia em
    // exercicio.service.ts, corrigido junto). `undefined` remove o
    // default 'application/json' do client e deixa o browser gerar
    // 'multipart/form-data; boundary=...' sozinho.
    const { data } = await apiClient.patch('/tenants/me/config', fd, {
      headers: { 'Content-Type': undefined },
    });
    return TenantConfigResponseSchema.parse(data);
  },
};
