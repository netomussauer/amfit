import {
  IniciarSessaoRequestSchema,
  RegistrarSerieRequestSchema,
  RegistroSerieResponseSchema,
  SessaoListResponseSchema,
  SessaoResponseSchema,
  type IniciarSessaoRequest,
  type RegistrarSerieRequest,
  type RegistroSerieResponse,
  type SessaoListResponse,
  type SessaoResponse,
} from '@amfit/shared';
import { apiRequest } from '@/shared/lib/api-client';

export const execucaoService = {
  /**
   * Inicia (ou recupera) a sessão de hoje para um treino.
   * Backend é idempotente: se já existe sessão EM_ANDAMENTO no dia, retorna a existente.
   */
  async iniciar(treinoId: string): Promise<SessaoResponse> {
    const body: IniciarSessaoRequest = IniciarSessaoRequestSchema.parse({
      treino_id: treinoId,
    });
    const data = await apiRequest<SessaoResponse>('/sessoes', {
      method: 'POST',
      body,
    });
    return SessaoResponseSchema.parse(data);
  },

  async buscar(sessaoId: string): Promise<SessaoResponse> {
    const data = await apiRequest<SessaoResponse>(`/sessoes/${sessaoId}`);
    return SessaoResponseSchema.parse(data);
  },

  /**
   * Upsert idempotente: se já existe registro com (sessao_id, item_treino_id, numero_serie)
   * o backend atualiza; caso contrário cria.
   */
  async registrarSerie(
    sessaoId: string,
    body: RegistrarSerieRequest,
  ): Promise<RegistroSerieResponse> {
    const validated = RegistrarSerieRequestSchema.parse(body);
    const data = await apiRequest<RegistroSerieResponse>(
      `/sessoes/${sessaoId}/series`,
      { method: 'PATCH', body: validated },
    );
    return RegistroSerieResponseSchema.parse(data);
  },

  async concluir(sessaoId: string): Promise<SessaoResponse> {
    const data = await apiRequest<SessaoResponse>(
      `/sessoes/${sessaoId}/concluir`,
      { method: 'PATCH' },
    );
    return SessaoResponseSchema.parse(data);
  },

  async listarMinhasSessoes(
    page: number,
    perPage: number,
  ): Promise<SessaoListResponse> {
    const data = await apiRequest<SessaoListResponse>('/alunos/me/sessoes', {
      params: { page, per_page: perPage },
    });
    return SessaoListResponseSchema.parse(data);
  },
};
