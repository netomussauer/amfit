import {
  AlunoListResponseSchema,
  AlunoResponseSchema,
  type AlunoListResponse,
  type AlunoResponse,
  type AtualizarAlunoRequest,
  type CriarAlunoRequest,
} from '@amfit/shared';
import { apiClient } from '@/shared/lib/api-client';
import type { AlunoListParams } from '../hooks/query-keys';

function normalizeOptional<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === '' || value === undefined) continue;
    out[key] = value;
  }
  return out as T;
}

export const alunoService = {
  async list(params: AlunoListParams): Promise<AlunoListResponse> {
    const query: Record<string, string | number | boolean> = {
      page: params.page,
      per_page: params.perPage,
    };
    if (typeof params.ativo === 'boolean') query.ativo = params.ativo;

    const { data } = await apiClient.get('/alunos', { params: query });
    return AlunoListResponseSchema.parse(data);
  },

  async getById(id: string): Promise<AlunoResponse> {
    const { data } = await apiClient.get(`/alunos/${id}`);
    return AlunoResponseSchema.parse(data);
  },

  async create(payload: CriarAlunoRequest): Promise<AlunoResponse> {
    const body = normalizeOptional(payload);
    const { data } = await apiClient.post('/alunos', body);
    return AlunoResponseSchema.parse(data);
  },

  async update(id: string, payload: AtualizarAlunoRequest): Promise<AlunoResponse> {
    const body = normalizeOptional(payload);
    const { data } = await apiClient.patch(`/alunos/${id}`, body);
    return AlunoResponseSchema.parse(data);
  },

  async deactivate(id: string): Promise<void> {
    await apiClient.delete(`/alunos/${id}`);
  },
};
