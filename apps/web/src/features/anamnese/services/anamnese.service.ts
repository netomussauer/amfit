import {
  AnamneseResponseSchema,
  RegistrarAnamneseRequestSchema,
  type AnamneseResponse,
  type RegistrarAnamneseRequest,
} from '@amfit/shared';
import { apiClient } from '@/shared/lib/api-client';
import { stripEmpty } from '@/shared/lib/strip-empty';

export const anamneseService = {
  /**
   * Busca a anamnese já registrada do aluno. O backend responde 404
   * (ProblemDetail) quando o aluno ainda não preencheu nenhuma — o erro é
   * propagado como AxiosError para o hook decidir como tratar (é um estado
   * esperado, não um erro inesperado).
   */
  async getByAluno(alunoId: string): Promise<AnamneseResponse> {
    const { data } = await apiClient.get(`/alunos/${alunoId}/anamnese`);
    return AnamneseResponseSchema.parse(data);
  },

  /**
   * Cria ou atualiza (upsert) a anamnese do aluno. A resposta inclui a
   * sugestão de template calculada na hora (`template_ficha_id`/`nome`) —
   * o GET não recalcula nem devolve esses dois campos.
   */
  async registrar(
    alunoId: string,
    payload: RegistrarAnamneseRequest,
  ): Promise<AnamneseResponse> {
    const body = RegistrarAnamneseRequestSchema.parse(stripEmpty(payload));
    const { data } = await apiClient.post(`/alunos/${alunoId}/anamnese`, body);
    return AnamneseResponseSchema.parse(data);
  },
};
