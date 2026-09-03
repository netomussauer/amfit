import {
  HistoricoExercicioResponseSchema,
  type HistoricoExercicioResponse,
  SugestaoProgressaoResponseSchema,
  type SugestaoProgressaoResponse,
} from '@amfit/shared';
import { apiRequest } from '@/shared/lib/api-client';

export type HistoricoExercicioQueryParams = {
  from?: string;
  to?: string;
  limit?: number;
};

export const progressoService = {
  /**
   * Histórico de progresso do próprio aluno autenticado (role ALUNO) para
   * um exercício específico. Espelha GET /alunos/me/progresso/exercicio/:id.
   */
  async getMeuProgresso(
    exercicioId: string,
    params?: HistoricoExercicioQueryParams,
  ): Promise<HistoricoExercicioResponse> {
    const data = await apiRequest<HistoricoExercicioResponse>(
      `/alunos/me/progresso/exercicio/${exercicioId}`,
      { params },
    );
    return HistoricoExercicioResponseSchema.parse(data);
  },

  /**
   * Sugestão de progressão de carga (progressive overload) do próprio
   * aluno autenticado para um exercício específico. Espelha
   * GET /alunos/me/progresso/exercicio/:id/sugestao.
   */
  async getMinhaSugestao(exercicioId: string): Promise<SugestaoProgressaoResponse> {
    const data = await apiRequest<SugestaoProgressaoResponse>(
      `/alunos/me/progresso/exercicio/${exercicioId}/sugestao`,
    );
    return SugestaoProgressaoResponseSchema.parse(data);
  },
};
