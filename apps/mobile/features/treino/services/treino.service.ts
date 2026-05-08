import {
  FichaResponseSchema,
  TreinoHojeResponseSchema,
  type FichaResponse,
  type TreinoHojeResponse,
} from '@amfit/shared';
import { apiRequest } from '@/shared/lib/api-client';

export const treinoService = {
  /**
   * Retorna o treino de hoje do aluno autenticado.
   * Backend retorna 204 quando não há ficha ativa ou treino agendado para hoje
   * (apiRequest devolve `undefined` nesses casos — convertemos para `null`).
   */
  async getTreinoHoje(): Promise<TreinoHojeResponse | null> {
    const data = await apiRequest<TreinoHojeResponse | undefined>(
      '/alunos/me/treino-hoje',
    );
    if (data === undefined || data === null) return null;
    return TreinoHojeResponseSchema.parse(data);
  },

  /**
   * Retorna a ficha ativa do aluno autenticado.
   * Backend devolve 404 quando o aluno não possui ficha ativa — propagamos via ApiError.
   */
  async getMinhaFicha(): Promise<FichaResponse> {
    const data = await apiRequest<FichaResponse>('/alunos/me/ficha');
    return FichaResponseSchema.parse(data);
  },
};
