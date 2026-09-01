import { beforeEach, describe, expect, it, vi } from 'vitest';
import { meuPerfilService } from './meu-perfil.service';

// `apiClient.get` (axios) tem uma assinatura fortemente sobrecarregada que
// dificulta tipar um mock diretamente contra `AxiosResponse`. Como o service
// so usa `{ data }` da resposta, criamos o mock via `vi.hoisted` e o service
// so enxerga um objeto `{ data: ... }`, exatamente como a lib real devolve.
const { mockedGet } = vi.hoisted(() => ({ mockedGet: vi.fn() }));

vi.mock('@/shared/lib/api-client', () => ({
  apiClient: { get: mockedGet },
}));

const alunoFixture = {
  id: '11111111-1111-1111-1111-111111111111',
  nome: 'Maria Silva',
  email: 'maria@exemplo.com',
  telefone: '11999998888',
  data_nascimento: '2000-05-20',
  sexo: 'F' as const,
  ativo: true,
  criado_em: '2026-01-01T00:00:00Z',
};

describe('meuPerfilService.buscar', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('busca /alunos/me e retorna os dados quando a resposta e valida', async () => {
    mockedGet.mockResolvedValueOnce({ data: alunoFixture });

    const resultado = await meuPerfilService.buscar();

    expect(mockedGet).toHaveBeenCalledWith('/alunos/me');
    expect(resultado).toEqual(alunoFixture);
  });

  it('lanca erro de validacao quando a resposta da API nao bate com o schema', async () => {
    mockedGet.mockResolvedValueOnce({ data: { ...alunoFixture, email: 'nao-e-um-email' } });

    await expect(meuPerfilService.buscar()).rejects.toThrow();
  });
});
