import {
  PlanoResponseSchema,
  type PlanoResponse,
  MensalidadeListResponseSchema,
  type MensalidadeListResponse,
} from '@amfit/shared';
import { apiRequest } from '@/shared/lib/api-client';

export type MinhasMensalidadesQueryParams = {
  status?: string;
  page?: number;
  per_page?: number;
};

export const financeiroService = {
  /**
   * Plano ATIVO do próprio aluno autenticado (role ALUNO). Espelha
   * GET /alunos/me/plano — devolve 404 quando o personal ainda não
   * configurou um plano pra esse aluno (estado esperado, tratado pelo
   * hook/tela, não um erro de validação).
   */
  async getMeuPlano(): Promise<PlanoResponse> {
    const data = await apiRequest<PlanoResponse>('/alunos/me/plano');
    return PlanoResponseSchema.parse(data);
  },

  /**
   * Mensalidades do próprio aluno autenticado (role ALUNO). Espelha
   * GET /alunos/me/mensalidades.
   */
  async getMinhasMensalidades(
    params?: MinhasMensalidadesQueryParams,
  ): Promise<MensalidadeListResponse> {
    const data = await apiRequest<MensalidadeListResponse>('/alunos/me/mensalidades', {
      params,
    });
    return MensalidadeListResponseSchema.parse(data);
  },
};
