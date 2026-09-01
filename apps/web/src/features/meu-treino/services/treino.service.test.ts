import { beforeEach, describe, expect, it, vi } from 'vitest';
import { treinoService } from './treino.service';

const { mockedGet } = vi.hoisted(() => ({ mockedGet: vi.fn() }));

vi.mock('@/shared/lib/api-client', () => ({
  apiClient: { get: mockedGet },
}));

const treinoPayload = {
  id: '11111111-1111-1111-1111-111111111111',
  letra: 'A',
  nome: 'Peito e tríceps',
  ordem: 0,
  itens: [],
};

describe('treinoService.getTreinoHoje', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('busca /alunos/me/treino-hoje e retorna os dados quando há treino', async () => {
    const payload = { treino: treinoPayload, sessao_hoje_id: null };
    mockedGet.mockResolvedValueOnce({ data: payload });

    const resultado = await treinoService.getTreinoHoje();

    expect(mockedGet).toHaveBeenCalledWith('/alunos/me/treino-hoje');
    expect(resultado).toEqual(payload);
  });

  it('retorna null quando o backend responde 204 (sem corpo)', async () => {
    mockedGet.mockResolvedValueOnce({ data: '' });

    const resultado = await treinoService.getTreinoHoje();

    expect(resultado).toBeNull();
  });

  it('retorna null quando o axios devolve data undefined', async () => {
    mockedGet.mockResolvedValueOnce({ data: undefined });

    const resultado = await treinoService.getTreinoHoje();

    expect(resultado).toBeNull();
  });

  it('lança erro de validação quando a resposta não bate com o schema', async () => {
    mockedGet.mockResolvedValueOnce({ data: { treino: { letra: 'A' } } });

    await expect(treinoService.getTreinoHoje()).rejects.toThrow();
  });
});

describe('treinoService.getMinhaFicha', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('busca /alunos/me/ficha e retorna a ficha ativa', async () => {
    const payload = {
      id: '22222222-2222-2222-2222-222222222222',
      nome: 'Ficha de hipertrofia',
      aluno_id: '33333333-3333-3333-3333-333333333333',
      vigencia_inicio: '2026-01-01',
      vigencia_fim: null,
      ativa: true,
      treinos: [treinoPayload],
    };
    mockedGet.mockResolvedValueOnce({ data: payload });

    const resultado = await treinoService.getMinhaFicha();

    expect(mockedGet).toHaveBeenCalledWith('/alunos/me/ficha');
    expect(resultado).toEqual(payload);
  });

  it('propaga o erro (ex.: 404 sem ficha ativa) sem tratar aqui', async () => {
    const error = new Error('Request failed with status code 404');
    mockedGet.mockRejectedValueOnce(error);

    await expect(treinoService.getMinhaFicha()).rejects.toThrow(error);
  });
});
