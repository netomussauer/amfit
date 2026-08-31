import { beforeEach, describe, expect, it, vi } from 'vitest';
import { progressoService } from './progresso.service';

// `apiClient.get` (axios) tem uma assinatura fortemente sobrecarregada
// (generics para o payload de resposta) que dificulta tipar um mock
// diretamente contra `AxiosResponse`. Como o service so usa `{ data }` da
// resposta, criamos o mock via `vi.hoisted` (evita a necessidade de
// referenciar o tipo real de `apiClient.get` neste arquivo) e o service so
// enxerga um objeto `{ data: ... }`, exatamente como a lib real devolve.
const { mockedGet } = vi.hoisted(() => ({ mockedGet: vi.fn() }));

vi.mock('@/shared/lib/api-client', () => ({
  apiClient: { get: mockedGet },
}));

describe('progressoService.getDashboard', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('busca /dashboard e retorna os dados quando a resposta e valida', async () => {
    const payload = {
      alunos_ativos: 12,
      fichas_ativas: 8,
      sessoes_ultimos_7_dias: 20,
      sessoes_ultimos_30_dias: 75,
      alunos_sem_sessao_7_dias: 3,
    };
    mockedGet.mockResolvedValueOnce({ data: payload });

    const resultado = await progressoService.getDashboard();

    expect(mockedGet).toHaveBeenCalledWith('/dashboard');
    expect(resultado).toEqual(payload);
  });

  it('lanca erro de validacao quando a resposta da API nao bate com o schema', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { alunos_ativos: 'doze' /* deveria ser number */ },
    });

    await expect(progressoService.getDashboard()).rejects.toThrow();
  });
});

describe('progressoService.getHistoricoExercicio', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('busca o historico no endpoint aninhado ao aluno/exercicio com os query params corretos', async () => {
    const payload = {
      aluno_id: '11111111-1111-1111-1111-111111111111',
      exercicio_id: '22222222-2222-2222-2222-222222222222',
      pontos: [],
    };
    mockedGet.mockResolvedValueOnce({ data: payload });

    const resultado = await progressoService.getHistoricoExercicio({
      alunoId: '11111111-1111-1111-1111-111111111111',
      exercicioId: '22222222-2222-2222-2222-222222222222',
      from: '2026-01-01',
      to: '2026-02-01',
      limit: 50,
    });

    expect(mockedGet).toHaveBeenCalledWith(
      '/alunos/11111111-1111-1111-1111-111111111111/progresso/exercicio/22222222-2222-2222-2222-222222222222',
      { params: { from: '2026-01-01', to: '2026-02-01', limit: 50 } },
    );
    expect(resultado).toEqual(payload);
  });

  it('funciona sem from/to/limit (todos opcionais)', async () => {
    const payload = {
      aluno_id: '11111111-1111-1111-1111-111111111111',
      exercicio_id: '22222222-2222-2222-2222-222222222222',
      pontos: [],
    };
    mockedGet.mockResolvedValueOnce({ data: payload });

    await progressoService.getHistoricoExercicio({
      alunoId: '11111111-1111-1111-1111-111111111111',
      exercicioId: '22222222-2222-2222-2222-222222222222',
    });

    expect(mockedGet).toHaveBeenCalledWith(expect.stringContaining('/progresso/exercicio/'), {
      params: { from: undefined, to: undefined, limit: undefined },
    });
  });

  it('lanca erro de validacao quando um ponto retornado tem formato de data invalido', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        aluno_id: '11111111-1111-1111-1111-111111111111',
        exercicio_id: '22222222-2222-2222-2222-222222222222',
        pontos: [
          {
            sessao_id: '33333333-3333-3333-3333-333333333333',
            data_execucao: '10/01/2026', // formato invalido, schema espera YYYY-MM-DD
            numero_serie: 1,
          },
        ],
      },
    });

    await expect(
      progressoService.getHistoricoExercicio({
        alunoId: '11111111-1111-1111-1111-111111111111',
        exercicioId: '22222222-2222-2222-2222-222222222222',
      }),
    ).rejects.toThrow();
  });
});
