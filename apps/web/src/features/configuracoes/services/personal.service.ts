import {
  PersonalResponseSchema,
  type AlterarSenhaRequest,
  type AtualizarPersonalRequest,
  type PersonalResponse,
} from '@amfit/shared';
import { apiClient } from '@/shared/lib/api-client';

function normalizeOptional<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === '' || value === undefined) continue;
    out[key] = value;
  }
  return out as T;
}

export const personalService = {
  async getMinhaConta(): Promise<PersonalResponse> {
    const { data } = await apiClient.get('/personal/me');
    return PersonalResponseSchema.parse(data);
  },

  async atualizarMinhaConta(payload: AtualizarPersonalRequest): Promise<PersonalResponse> {
    const body = normalizeOptional(payload);
    const { data } = await apiClient.patch('/personal/me', body);
    return PersonalResponseSchema.parse(data);
  },

  async alterarMinhaSenha(payload: AlterarSenhaRequest): Promise<void> {
    await apiClient.patch('/personal/me/senha', payload);
  },
};
