import { beforeEach, describe, expect, it, vi } from 'vitest';
import { execucaoService } from './execucao.service';

const { mockedGet, mockedPost, mockedPatch } = vi.hoisted(() => ({
  mockedGet: vi.fn(),
  mockedPost: vi.fn(),
  mockedPatch: vi.fn(),
}));

vi.mock('@/shared/lib/api-client', () => ({
  apiClient: { get: mockedGet, post: mockedPost, patch: mockedPatch },
}));

const sessaoPayload = {
  id: '11111111-1111-1111-1111-111111111111',
  treino_id: '22222222-2222-2222-2222-222222222222',
  data_execucao: '2026-08-31',
  status: 'EM_ANDAMENTO',
  iniciado_em: '2026-08-31T12:00:00Z',
  concluido_em: null,
  series: [],
};

describe('execucaoService.iniciar', () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it('valida o treino_id e faz POST /sessoes', async () => {
    mockedPost.mockResolvedValueOnce({ data: sessaoPayload });

    const resultado = await execucaoService.iniciar(sessaoPayload.treino_id);

    expect(mockedPost).toHaveBeenCalledWith('/sessoes', {
      treino_id: sessaoPayload.treino_id,
    });
    expect(resultado).toEqual(sessaoPayload);
  });

  it('rejeita treino_id que não é UUID antes de chamar a API', async () => {
    await expect(execucaoService.iniciar('nao-e-uuid')).rejects.toThrow();
    expect(mockedPost).not.toHaveBeenCalled();
  });
});

describe('execucaoService.buscar', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('busca GET /sessoes/:id', async () => {
    mockedGet.mockResolvedValueOnce({ data: sessaoPayload });

    const resultado = await execucaoService.buscar(sessaoPayload.id);

    expect(mockedGet).toHaveBeenCalledWith(`/sessoes/${sessaoPayload.id}`);
    expect(resultado).toEqual(sessaoPayload);
  });
});

describe('execucaoService.registrarSerie', () => {
  beforeEach(() => {
    mockedPatch.mockReset();
  });

  it('faz PATCH /sessoes/:id/series com o corpo validado', async () => {
    const body = {
      item_treino_id: '33333333-3333-3333-3333-333333333333',
      numero_serie: 1,
      concluida: true,
      carga_realizada: 20,
      repeticoes_realizadas: 12,
    };
    const registroPayload = {
      id: '44444444-4444-4444-4444-444444444444',
      ...body,
      executado_em: '2026-08-31T12:05:00Z',
    };
    mockedPatch.mockResolvedValueOnce({ data: registroPayload });

    const resultado = await execucaoService.registrarSerie(sessaoPayload.id, body);

    expect(mockedPatch).toHaveBeenCalledWith(
      `/sessoes/${sessaoPayload.id}/series`,
      body,
    );
    expect(resultado).toEqual(registroPayload);
  });
});

describe('execucaoService.concluir', () => {
  beforeEach(() => {
    mockedPatch.mockReset();
  });

  it('faz PATCH /sessoes/:id/concluir sem corpo', async () => {
    const concluida = { ...sessaoPayload, status: 'CONCLUIDO', concluido_em: '2026-08-31T13:00:00Z' };
    mockedPatch.mockResolvedValueOnce({ data: concluida });

    const resultado = await execucaoService.concluir(sessaoPayload.id);

    expect(mockedPatch).toHaveBeenCalledWith(`/sessoes/${sessaoPayload.id}/concluir`);
    expect(resultado).toEqual(concluida);
  });
});

describe('execucaoService.listarMinhasSessoes', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('busca GET /alunos/me/sessoes com paginação', async () => {
    const payload = {
      data: [],
      pagination: { total: 0, page: 1, per_page: 20 },
    };
    mockedGet.mockResolvedValueOnce({ data: payload });

    const resultado = await execucaoService.listarMinhasSessoes(1, 20);

    expect(mockedGet).toHaveBeenCalledWith('/alunos/me/sessoes', {
      params: { page: 1, per_page: 20 },
    });
    expect(resultado).toEqual(payload);
  });
});
