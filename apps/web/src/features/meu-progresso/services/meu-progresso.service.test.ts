import { beforeEach, describe, expect, it, vi } from 'vitest';
import { meuProgressoService } from './meu-progresso.service';

// `apiClient.get` (axios) tem uma assinatura fortemente sobrecarregada que
// dificulta tipar um mock diretamente contra `AxiosResponse`. Como o service
// so usa `{ data }` da resposta, criamos o mock via `vi.hoisted` e o service
// so enxerga um objeto `{ data: ... }`, exatamente como a lib real devolve.
const { mockedGet } = vi.hoisted(() => ({ mockedGet: vi.fn() }));

vi.mock('@/shared/lib/api-client', () => ({
  apiClient: { get: mockedGet },
}));

describe('meuProgressoService.getMeuProgresso', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('busca o historico no endpoint /alunos/me/progresso/exercicio/:id com os query params corretos', async () => {
    const payload = {
      aluno_id: '11111111-1111-1111-1111-111111111111',
      exercicio_id: '22222222-2222-2222-2222-222222222222',
      pontos: [],
    };
    mockedGet.mockResolvedValueOnce({ data: payload });

    const resultado = await meuProgressoService.getMeuProgresso({
      exercicioId: '22222222-2222-2222-2222-222222222222',
      from: '2026-01-01',
      to: '2026-02-01',
      limit: 50,
    });

    expect(mockedGet).toHaveBeenCalledWith(
      '/alunos/me/progresso/exercicio/22222222-2222-2222-2222-222222222222',
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

    await meuProgressoService.getMeuProgresso({
      exercicioId: '22222222-2222-2222-2222-222222222222',
    });

    expect(mockedGet).toHaveBeenCalledWith(expect.stringContaining('/alunos/me/progresso/exercicio/'), {
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
      meuProgressoService.getMeuProgresso({
        exercicioId: '22222222-2222-2222-2222-222222222222',
      }),
    ).rejects.toThrow();
  });
});

describe('meuProgressoService.getMinhaSugestao', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('busca a sugestao no endpoint /alunos/me/progresso/exercicio/:id/sugestao', async () => {
    const payload = {
      exercicio_id: '22222222-2222-2222-2222-222222222222',
      tem_sugestao: true,
      direcao: 'AUMENTAR',
      carga_sugerida: 22.5,
      ultima_carga_registrada: 20,
      ultima_media_repeticoes: 10,
    };
    mockedGet.mockResolvedValueOnce({ data: payload });

    const resultado = await meuProgressoService.getMinhaSugestao(
      '22222222-2222-2222-2222-222222222222',
    );

    expect(mockedGet).toHaveBeenCalledWith(
      '/alunos/me/progresso/exercicio/22222222-2222-2222-2222-222222222222/sugestao',
    );
    expect(resultado).toEqual(payload);
  });

  it('aceita tem_sugestao=false sem os campos opcionais', async () => {
    const payload = {
      exercicio_id: '22222222-2222-2222-2222-222222222222',
      tem_sugestao: false,
    };
    mockedGet.mockResolvedValueOnce({ data: payload });

    const resultado = await meuProgressoService.getMinhaSugestao(
      '22222222-2222-2222-2222-222222222222',
    );

    expect(resultado.tem_sugestao).toBe(false);
    expect(resultado.carga_sugerida).toBeUndefined();
  });

  it('lanca erro de validacao quando direcao tem um valor fora do enum esperado', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        exercicio_id: '22222222-2222-2222-2222-222222222222',
        tem_sugestao: true,
        direcao: 'DIMINUIR',
        carga_sugerida: 10,
      },
    });

    await expect(
      meuProgressoService.getMinhaSugestao('22222222-2222-2222-2222-222222222222'),
    ).rejects.toThrow();
  });
});
