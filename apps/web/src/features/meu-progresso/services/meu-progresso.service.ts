import {
  HistoricoExercicioResponseSchema,
  type HistoricoExercicioResponse,
  SugestaoProgressaoResponseSchema,
  type SugestaoProgressaoResponse,
} from '@amfit/shared';
import { apiClient } from '@/shared/lib/api-client';
import type { MeuProgressoParams } from '../hooks/query-keys';

/**
 * Histórico de progresso do próprio aluno autenticado (role ALUNO) para um
 * exercício específico. Espelha GET /alunos/me/progresso/exercicio/:id — a
 * variante "self" de GET /alunos/:alunoId/progresso/exercicio/:exercicioId,
 * usada pelo PERSONAL em features/progresso.
 */
export const meuProgressoService = {
  async getMeuProgresso(
    params: MeuProgressoParams,
  ): Promise<HistoricoExercicioResponse> {
    const { exercicioId, from, to, limit } = params;
    const { data } = await apiClient.get(
      `/alunos/me/progresso/exercicio/${exercicioId}`,
      { params: { from, to, limit } },
    );
    return HistoricoExercicioResponseSchema.parse(data);
  },

  /**
   * Sugestão de progressão de carga (progressive overload) do próprio
   * aluno autenticado para um exercício específico. Espelha
   * GET /alunos/me/progresso/exercicio/:id/sugestao.
   */
  async getMinhaSugestao(exercicioId: string): Promise<SugestaoProgressaoResponse> {
    const { data } = await apiClient.get(
      `/alunos/me/progresso/exercicio/${exercicioId}/sugestao`,
    );
    return SugestaoProgressaoResponseSchema.parse(data);
  },
};
