import { AlunoResponseSchema, type AlunoResponse } from '@amfit/shared';
import { apiClient } from '@/shared/lib/api-client';

/**
 * Perfil do próprio aluno autenticado (role ALUNO). Espelha GET /alunos/me.
 *
 * Deliberadamente somente leitura: o backend não expõe PATCH para ALUNO em
 * `/alunos/me` (só PERSONAL tem self-service completo via /personal/me).
 * Ver apps/mobile/app/(aluno)/perfil.tsx, que segue a mesma limitação.
 */
export const meuPerfilService = {
  async buscar(): Promise<AlunoResponse> {
    const { data } = await apiClient.get('/alunos/me');
    return AlunoResponseSchema.parse(data);
  },
};
