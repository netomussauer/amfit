import {
  SessaoListResponseSchema,
  SessaoResponseSchema,
  type SessaoListResponse,
  type SessaoResponse,
} from '@amfit/shared';
import { apiClient } from '@/shared/lib/api-client';
import type { SessoesPorAlunoParams } from '../hooks/query-keys';

export const sessaoService = {
  async listByAluno(params: SessoesPorAlunoParams): Promise<SessaoListResponse> {
    const { alunoId, page, perPage } = params;
    const { data } = await apiClient.get(`/alunos/${alunoId}/sessoes`, {
      params: { page, per_page: perPage },
    });
    return SessaoListResponseSchema.parse(data);
  },

  async getById(id: string): Promise<SessaoResponse> {
    const { data } = await apiClient.get(`/sessoes/${id}`);
    return SessaoResponseSchema.parse(data);
  },
};
