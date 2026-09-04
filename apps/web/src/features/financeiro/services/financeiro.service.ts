import {
  PlanoResponseSchema,
  MensalidadeResponseSchema,
  MensalidadeListResponseSchema,
  DashboardFinanceiroResponseSchema,
  type PlanoResponse,
  type CriarPlanoRequest,
  type AtualizarPlanoRequest,
  type MensalidadeResponse,
  type MensalidadeListResponse,
  type MarcarPagaRequest,
  type AtualizarStatusMensalidadeRequest,
  type DashboardFinanceiroResponse,
} from '@amfit/shared';
import { apiClient } from '@/shared/lib/api-client';
import type { MensalidadeListParams } from '../hooks/query-keys';

function normalizeOptional<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === '' || value === undefined) continue;
    out[key] = value;
  }
  return out as T;
}

export const financeiroService = {
  async getPlano(alunoId: string): Promise<PlanoResponse> {
    const { data } = await apiClient.get(`/alunos/${alunoId}/plano`);
    return PlanoResponseSchema.parse(data);
  },

  async configurarPlano(alunoId: string, payload: CriarPlanoRequest): Promise<PlanoResponse> {
    const body = normalizeOptional(payload);
    const { data } = await apiClient.post(`/alunos/${alunoId}/plano`, body);
    return PlanoResponseSchema.parse(data);
  },

  async atualizarPlano(planoId: string, payload: AtualizarPlanoRequest): Promise<PlanoResponse> {
    const { data } = await apiClient.patch(`/planos/${planoId}`, payload);
    return PlanoResponseSchema.parse(data);
  },

  async listMensalidades(params: MensalidadeListParams): Promise<MensalidadeListResponse> {
    const query: Record<string, string | number> = {
      page: params.page,
      per_page: params.perPage,
    };
    if (params.alunoId) query.aluno_id = params.alunoId;
    if (params.status) query.status = params.status;
    if (params.competenciaAno) query.competencia_ano = params.competenciaAno;
    if (params.competenciaMes) query.competencia_mes = params.competenciaMes;

    const { data } = await apiClient.get('/mensalidades', { params: query });
    return MensalidadeListResponseSchema.parse(data);
  },

  async marcarPaga(
    mensalidadeId: string,
    payload: MarcarPagaRequest,
  ): Promise<MensalidadeResponse> {
    const body = normalizeOptional(payload);
    const { data } = await apiClient.patch(`/mensalidades/${mensalidadeId}/marcar-paga`, body);
    return MensalidadeResponseSchema.parse(data);
  },

  async atualizarStatusMensalidade(
    mensalidadeId: string,
    payload: AtualizarStatusMensalidadeRequest,
  ): Promise<MensalidadeResponse> {
    const { data } = await apiClient.patch(`/mensalidades/${mensalidadeId}`, payload);
    return MensalidadeResponseSchema.parse(data);
  },

  async getDashboard(): Promise<DashboardFinanceiroResponse> {
    const { data } = await apiClient.get('/financeiro/dashboard');
    return DashboardFinanceiroResponseSchema.parse(data);
  },
};
