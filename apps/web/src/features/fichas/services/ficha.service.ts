import {
  AtualizarFichaRequestSchema,
  AtualizarItemTreinoRequestSchema,
  AtualizarTreinoRequestSchema,
  CriarFichaRequestSchema,
  CriarItemTreinoRequestSchema,
  CriarTreinoRequestSchema,
  FichaListResponseSchema,
  FichaResponseSchema,
  ItemTreinoResponseSchema,
  ReordenarItensRequestSchema,
  TreinoResponseSchema,
  type AtualizarFichaRequest,
  type AtualizarItemTreinoRequest,
  type AtualizarTreinoRequest,
  type CriarFichaRequest,
  type CriarItemTreinoRequest,
  type CriarTreinoRequest,
  type FichaListResponse,
  type FichaResponse,
  type ItemTreinoResponse,
  type ReordenarItensRequest,
  type TreinoResponse,
} from '@amfit/shared';
import { apiClient } from '@/shared/lib/api-client';
import type { FichaListParams } from '../hooks/query-keys';

function stripEmpty<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === '' || value === undefined) continue;
    out[key] = value;
  }
  return out as Partial<T>;
}

function buildListQuery(
  params: FichaListParams,
): Record<string, string | boolean> {
  const query: Record<string, string | boolean> = {};
  if (params.aluno_id) query.aluno_id = params.aluno_id;
  if (typeof params.ativa === 'boolean') query.ativa = params.ativa;
  return query;
}

export const fichaService = {
  // ── Fichas ──────────────────────────────────────────────────────────

  async list(params: FichaListParams): Promise<FichaListResponse> {
    const { data } = await apiClient.get('/fichas', {
      params: buildListQuery(params),
    });
    return FichaListResponseSchema.parse(data);
  },

  async getById(id: string): Promise<FichaResponse> {
    const { data } = await apiClient.get(`/fichas/${id}`);
    return FichaResponseSchema.parse(data);
  },

  async create(payload: CriarFichaRequest): Promise<FichaResponse> {
    const body = CriarFichaRequestSchema.parse(stripEmpty(payload));
    const { data } = await apiClient.post('/fichas', body);
    return FichaResponseSchema.parse(data);
  },

  async update(
    id: string,
    payload: AtualizarFichaRequest,
  ): Promise<FichaResponse> {
    const body = AtualizarFichaRequestSchema.parse(stripEmpty(payload));
    const { data } = await apiClient.patch(`/fichas/${id}`, body);
    return FichaResponseSchema.parse(data);
  },

  async deactivate(id: string): Promise<void> {
    await apiClient.delete(`/fichas/${id}`);
  },

  // ── Treinos ─────────────────────────────────────────────────────────

  async createTreino(
    fichaId: string,
    payload: CriarTreinoRequest,
  ): Promise<TreinoResponse> {
    const body = CriarTreinoRequestSchema.parse(stripEmpty(payload));
    const { data } = await apiClient.post(`/fichas/${fichaId}/treinos`, body);
    return TreinoResponseSchema.parse(data);
  },

  async updateTreino(
    treinoId: string,
    payload: AtualizarTreinoRequest,
  ): Promise<TreinoResponse> {
    const body = AtualizarTreinoRequestSchema.parse(stripEmpty(payload));
    const { data } = await apiClient.patch(`/treinos/${treinoId}`, body);
    return TreinoResponseSchema.parse(data);
  },

  async deleteTreino(treinoId: string): Promise<void> {
    await apiClient.delete(`/treinos/${treinoId}`);
  },

  // ── Itens ───────────────────────────────────────────────────────────

  async createItem(
    treinoId: string,
    payload: CriarItemTreinoRequest,
  ): Promise<ItemTreinoResponse> {
    const body = CriarItemTreinoRequestSchema.parse(stripEmpty(payload));
    const { data } = await apiClient.post(`/treinos/${treinoId}/itens`, body);
    return ItemTreinoResponseSchema.parse(data);
  },

  async updateItem(
    itemId: string,
    payload: AtualizarItemTreinoRequest,
  ): Promise<ItemTreinoResponse> {
    const body = AtualizarItemTreinoRequestSchema.parse(stripEmpty(payload));
    const { data } = await apiClient.patch(`/itens/${itemId}`, body);
    return ItemTreinoResponseSchema.parse(data);
  },

  async deleteItem(itemId: string): Promise<void> {
    await apiClient.delete(`/itens/${itemId}`);
  },

  async reordenarItens(
    treinoId: string,
    payload: ReordenarItensRequest,
  ): Promise<TreinoResponse> {
    const body = ReordenarItensRequestSchema.parse(payload);
    const { data } = await apiClient.patch(
      `/treinos/${treinoId}/itens/reordenar`,
      body,
    );
    return TreinoResponseSchema.parse(data);
  },
};
