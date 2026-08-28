import {
  DashboardResponseSchema,
  HistoricoExercicioResponseSchema,
  type DashboardResponse,
  type HistoricoExercicioResponse,
} from '@amfit/shared';
import { apiClient } from '@/shared/lib/api-client';
import type { HistoricoExercicioParams } from '../hooks/query-keys';

export const progressoService = {
  async getDashboard(): Promise<DashboardResponse> {
    const { data } = await apiClient.get('/dashboard');
    return DashboardResponseSchema.parse(data);
  },

  async getHistoricoExercicio(
    params: HistoricoExercicioParams,
  ): Promise<HistoricoExercicioResponse> {
    const { alunoId, exercicioId, from, to, limit } = params;
    const { data } = await apiClient.get(
      `/alunos/${alunoId}/progresso/exercicio/${exercicioId}`,
      { params: { from, to, limit } },
    );
    return HistoricoExercicioResponseSchema.parse(data);
  },
};
