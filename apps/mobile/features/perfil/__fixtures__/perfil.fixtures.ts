import type { AlunoResponse } from '@amfit/shared';

export function makeAlunoResponse(overrides: Partial<AlunoResponse> = {}): AlunoResponse {
  return {
    id: '80000000-0000-0000-0000-000000000001',
    nome: 'Aluno Teste',
    email: 'aluno@example.com',
    telefone: null,
    data_nascimento: '2000-01-01',
    sexo: 'M',
    ativo: true,
    criado_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
