import { z } from 'zod';
import {
  ExercicioListResponseSchema,
  ExercicioResponseSchema,
  GrupoMuscularSchema,
  type AtualizarExercicioRequest,
  type CriarExercicioRequest,
  type ExercicioListResponse,
  type ExercicioResponse,
  type GrupoMuscular,
} from '@amfit/shared';
import { apiClient } from '@/shared/lib/api-client';
import type { ExercicioListParams } from '../hooks/query-keys';

const GrupoMuscularListSchema = z.array(GrupoMuscularSchema);

function buildListQuery(params: ExercicioListParams): Record<string, string> {
  const query: Record<string, string> = {};
  if (params.grupo_muscular_id) query.grupo_muscular_id = params.grupo_muscular_id;
  if (params.busca && params.busca.trim().length > 0) query.busca = params.busca.trim();
  return query;
}

export const exercicioService = {
  async listGrupos(): Promise<GrupoMuscular[]> {
    const { data } = await apiClient.get('/grupos-musculares');
    return GrupoMuscularListSchema.parse(data);
  },

  async list(params: ExercicioListParams): Promise<ExercicioListResponse> {
    const { data } = await apiClient.get('/exercicios', {
      params: buildListQuery(params),
    });
    return ExercicioListResponseSchema.parse(data);
  },

  async getById(id: string): Promise<ExercicioResponse> {
    const { data } = await apiClient.get(`/exercicios/${id}`);
    return ExercicioResponseSchema.parse(data);
  },

  async create(
    payload: CriarExercicioRequest,
    midia: File | null,
  ): Promise<ExercicioResponse> {
    const fd = new FormData();
    fd.append('nome', payload.nome);
    fd.append('grupo_muscular_id', payload.grupo_muscular_id);
    if (payload.descricao && payload.descricao.length > 0) {
      fd.append('descricao', payload.descricao);
    }
    if (midia) {
      fd.append('midia', midia);
    }
    const { data } = await apiClient.post('/exercicios', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return ExercicioResponseSchema.parse(data);
  },

  async update(
    id: string,
    payload: AtualizarExercicioRequest,
  ): Promise<ExercicioResponse> {
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value === '' || value === undefined) continue;
      body[key] = value;
    }
    const { data } = await apiClient.patch(`/exercicios/${id}`, body);
    return ExercicioResponseSchema.parse(data);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/exercicios/${id}`);
  },
};
