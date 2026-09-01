import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessaoService } from './sessao.service';

// `apiClient.get` (axios) tem uma assinatura fortemente sobrecarregada que
// dificulta tipar um mock diretamente contra `AxiosResponse`. Como o service
// so usa `{ data }` da resposta, criamos o mock via `vi.hoisted` e o service
// so enxerga um objeto `{ data: ... }`, exatamente como a lib real devolve.
const { mockedGet } = vi.hoisted(() => ({ mockedGet: vi.fn() }));

vi.mock('@/shared/lib/api-client', () => ({
  apiClient: { get: mockedGet },
}));

const sessaoResumoFixture = {
  id: '11111111-1111-1111-1111-111111111111',
  treino_id: '22222222-2222-2222-2222-222222222222',
  treino_letra: 'A',
  treino_nome: 'Treino de peito',
  data_execucao: '2026-01-10',
  status: 'CONCLUIDO' as const,
  iniciado_em: '2026-01-10T10:00:00Z',
  concluido_em: '2026-01-10T11:00:00Z',
  total_series: 12,
  series_concluidas: 12,
};

const sessaoFixture = {
  id: '11111111-1111-1111-1111-111111111111',
  treino_id: '22222222-2222-2222-2222-222222222222',
  data_execucao: '2026-01-10',
  status: 'CONCLUIDO' as const,
  iniciado_em: '2026-01-10T10:00:00Z',
  concluido_em: '2026-01-10T11:00:00Z',
  series: [],
};

describe('sessaoService.listByAluno', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('busca /alunos/:id/sessoes com page e per_page corretos', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: [sessaoResumoFixture], pagination: { total: 1, page: 1, per_page: 20 } },
    });

    const resultado = await sessaoService.listByAluno({
      alunoId: '33333333-3333-3333-3333-333333333333',
      page: 1,
      perPage: 20,
    });

    expect(mockedGet).toHaveBeenCalledWith(
      '/alunos/33333333-3333-3333-3333-333333333333/sessoes',
      { params: { page: 1, per_page: 20 } },
    );
    expect(resultado).toEqual({
      data: [sessaoResumoFixture],
      pagination: { total: 1, page: 1, per_page: 20 },
    });
  });

  it('lanca erro de validacao quando a resposta nao bate com o schema', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: [{ ...sessaoResumoFixture, status: 'STATUS_INVALIDO' }], pagination: { total: 1, page: 1, per_page: 20 } },
    });

    await expect(
      sessaoService.listByAluno({ alunoId: '33333333-3333-3333-3333-333333333333', page: 1, perPage: 20 }),
    ).rejects.toThrow();
  });
});

describe('sessaoService.getById', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('busca /sessoes/:id e retorna os dados quando a resposta e valida', async () => {
    mockedGet.mockResolvedValueOnce({ data: sessaoFixture });

    const resultado = await sessaoService.getById(sessaoFixture.id);

    expect(mockedGet).toHaveBeenCalledWith(`/sessoes/${sessaoFixture.id}`);
    expect(resultado).toEqual(sessaoFixture);
  });

  it('lanca erro de validacao quando data_execucao nao bate com o formato YYYY-MM-DD', async () => {
    mockedGet.mockResolvedValueOnce({ data: { ...sessaoFixture, data_execucao: '10/01/2026' } });

    await expect(sessaoService.getById(sessaoFixture.id)).rejects.toThrow();
  });
});
