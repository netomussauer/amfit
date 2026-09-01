import {
  SessaoListResponseSchema,
  SessaoResponseSchema,
  type SessaoListResponse,
  type SessaoResponse,
} from '@amfit/shared';
import { apiClient } from '@/shared/lib/api-client';
import type { MinhasSessoesParams } from '../hooks/query-keys';

/**
 * Histórico de sessões do próprio aluno autenticado (role ALUNO). Espelha
 * GET /alunos/me/sessoes (lista) e GET /sessoes/:id (detalhe — mesma rota
 * usada pelo PERSONAL, o backend autoriza o aluno dono da sessão).
 */
export const meuHistoricoService = {
  async listar(params: MinhasSessoesParams): Promise<SessaoListResponse> {
    const { page, perPage } = params;
    const { data } = await apiClient.get('/alunos/me/sessoes', {
      params: { page, per_page: perPage },
    });
    return SessaoListResponseSchema.parse(data);
  },

  async buscar(sessaoId: string): Promise<SessaoResponse> {
    const { data } = await apiClient.get(`/sessoes/${sessaoId}`);
    return SessaoResponseSchema.parse(data);
  },
};
