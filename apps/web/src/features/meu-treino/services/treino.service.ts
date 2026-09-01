import {
  FichaResponseSchema,
  TreinoHojeResponseSchema,
  type FichaResponse,
  type TreinoHojeResponse,
} from '@amfit/shared';
import { apiClient } from '@/shared/lib/api-client';

export const treinoService = {
  /**
   * Retorna o treino de hoje do aluno autenticado.
   * Backend retorna 204 (sem corpo) quando não há ficha ativa ou não há
   * treino agendado para hoje — axios devolve `data` como string vazia ou
   * `undefined` nesse caso, normalizamos para `null`.
   */
  async getTreinoHoje(): Promise<TreinoHojeResponse | null> {
    const { data } = await apiClient.get('/alunos/me/treino-hoje');
    if (data === undefined || data === null || data === '') return null;
    return TreinoHojeResponseSchema.parse(data);
  },

  /**
   * Retorna a ficha ativa do aluno autenticado.
   * Backend devolve 404 quando o aluno não possui ficha ativa — o erro é
   * propagado como AxiosError para o hook decidir como tratar.
   */
  async getMinhaFicha(): Promise<FichaResponse> {
    const { data } = await apiClient.get('/alunos/me/ficha');
    return FichaResponseSchema.parse(data);
  },
};
