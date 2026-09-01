import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fichaService } from './ficha.service';

// `apiClient.get/post/patch/delete` (axios) tem uma assinatura fortemente
// sobrecarregada (generics para o payload de resposta) que dificulta tipar
// um mock diretamente contra `AxiosResponse`. Como o service so usa
// `{ data }` da resposta, criamos o mock via `vi.hoisted` e o service so
// enxerga um objeto `{ data: ... }`, exatamente como a lib real devolve.
const { mockedGet, mockedPost, mockedPatch, mockedDelete } = vi.hoisted(() => ({
  mockedGet: vi.fn(),
  mockedPost: vi.fn(),
  mockedPatch: vi.fn(),
  mockedDelete: vi.fn(),
}));

vi.mock('@/shared/lib/api-client', () => ({
  apiClient: { get: mockedGet, post: mockedPost, patch: mockedPatch, delete: mockedDelete },
}));

const alunoId = '11111111-1111-1111-1111-111111111111';
const fichaId = '22222222-2222-2222-2222-222222222222';
const treinoId = '33333333-3333-3333-3333-333333333333';
const itemId = '44444444-4444-4444-4444-444444444444';
const exercicioId = '55555555-5555-5555-5555-555555555555';
const grupoMuscularId = '66666666-6666-6666-6666-666666666666';

const exercicioFixture = {
  id: exercicioId,
  nome: 'Supino reto',
  grupo_muscular: { id: grupoMuscularId, nome: 'Peito' },
  is_global: true,
};

const itemFixture = {
  id: itemId,
  ordem: 0,
  exercicio: exercicioFixture,
  series: 3,
  repeticoes: '8-12',
};

const treinoFixture = {
  id: treinoId,
  letra: 'A',
  ordem: 0,
  itens: [itemFixture],
};

const fichaFixture = {
  id: fichaId,
  nome: 'Hipertrofia — Maio/2026',
  aluno_id: alunoId,
  vigencia_inicio: '2026-05-01',
  ativa: true,
  treinos: [treinoFixture],
};

describe('fichaService.list', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('busca /fichas sem filtros quando nenhum param e informado', async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: [fichaFixture] } });

    const resultado = await fichaService.list({});

    expect(mockedGet).toHaveBeenCalledWith('/fichas', { params: {} });
    expect(resultado).toEqual({ data: [fichaFixture] });
  });

  it('inclui aluno_id e ativa na query quando informados', async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: [fichaFixture] } });

    await fichaService.list({ aluno_id: alunoId, ativa: true });

    expect(mockedGet).toHaveBeenCalledWith('/fichas', {
      params: { aluno_id: alunoId, ativa: true },
    });
  });

  it('inclui ativa: false na query (nao trata false como ausente)', async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: [] } });

    await fichaService.list({ ativa: false });

    expect(mockedGet).toHaveBeenCalledWith('/fichas', { params: { ativa: false } });
  });

  it('lanca erro de validacao quando a resposta da API nao bate com o schema', async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: [{ ...fichaFixture, ativa: 'sim' }] } });

    await expect(fichaService.list({})).rejects.toThrow();
  });
});

describe('fichaService.getById', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('busca /fichas/:id e retorna os dados quando a resposta e valida', async () => {
    mockedGet.mockResolvedValueOnce({ data: fichaFixture });

    const resultado = await fichaService.getById(fichaId);

    expect(mockedGet).toHaveBeenCalledWith(`/fichas/${fichaId}`);
    expect(resultado).toEqual(fichaFixture);
  });

  it('lanca erro de validacao quando a resposta da API nao bate com o schema', async () => {
    mockedGet.mockResolvedValueOnce({ data: { ...fichaFixture, vigencia_inicio: '01/05/2026' } });

    await expect(fichaService.getById(fichaId)).rejects.toThrow();
  });
});

describe('fichaService.create', () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it('valida e envia POST /fichas removendo campos vazios do payload', async () => {
    mockedPost.mockResolvedValueOnce({ data: fichaFixture });

    const resultado = await fichaService.create({
      aluno_id: alunoId,
      nome: 'Hipertrofia — Maio/2026',
      vigencia_inicio: '2026-05-01',
      vigencia_fim: '',
    });

    expect(mockedPost).toHaveBeenCalledWith('/fichas', {
      aluno_id: alunoId,
      nome: 'Hipertrofia — Maio/2026',
      vigencia_inicio: '2026-05-01',
    });
    expect(resultado).toEqual(fichaFixture);
  });

  it('lanca erro de validacao antes de enviar quando o payload e invalido', async () => {
    await expect(
      fichaService.create({
        aluno_id: 'nao-e-um-uuid',
        nome: 'X',
        vigencia_inicio: '2026-05-01',
      }),
    ).rejects.toThrow();

    expect(mockedPost).not.toHaveBeenCalled();
  });
});

describe('fichaService.update', () => {
  beforeEach(() => {
    mockedPatch.mockReset();
  });

  it('valida e envia PATCH /fichas/:id apenas com os campos preenchidos', async () => {
    mockedPatch.mockResolvedValueOnce({ data: fichaFixture });

    const resultado = await fichaService.update(fichaId, {
      nome: 'Nome atualizado',
      vigencia_fim: '',
    });

    expect(mockedPatch).toHaveBeenCalledWith(`/fichas/${fichaId}`, {
      nome: 'Nome atualizado',
    });
    expect(resultado).toEqual(fichaFixture);
  });
});

describe('fichaService.deactivate', () => {
  beforeEach(() => {
    mockedDelete.mockReset();
  });

  it('envia DELETE /fichas/:id', async () => {
    mockedDelete.mockResolvedValueOnce({ data: undefined });

    const resultado = await fichaService.deactivate(fichaId);

    expect(mockedDelete).toHaveBeenCalledWith(`/fichas/${fichaId}`);
    expect(resultado).toBeUndefined();
  });
});

describe('fichaService.createTreino', () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it('valida e envia POST /fichas/:fichaId/treinos', async () => {
    mockedPost.mockResolvedValueOnce({ data: treinoFixture });

    const resultado = await fichaService.createTreino(fichaId, {
      letra: 'A',
      ordem: 0,
      nome: '',
    });

    expect(mockedPost).toHaveBeenCalledWith(`/fichas/${fichaId}/treinos`, {
      letra: 'A',
      ordem: 0,
    });
    expect(resultado).toEqual(treinoFixture);
  });
});

describe('fichaService.updateTreino', () => {
  beforeEach(() => {
    mockedPatch.mockReset();
  });

  it('valida e envia PATCH /treinos/:treinoId', async () => {
    mockedPatch.mockResolvedValueOnce({ data: treinoFixture });

    const resultado = await fichaService.updateTreino(treinoId, { nome: 'Peito e tríceps' });

    expect(mockedPatch).toHaveBeenCalledWith(`/treinos/${treinoId}`, {
      nome: 'Peito e tríceps',
    });
    expect(resultado).toEqual(treinoFixture);
  });

  it('permite limpar o nome do treino enviando string vazia explicitamente', async () => {
    mockedPatch.mockResolvedValueOnce({ data: treinoFixture });

    await fichaService.updateTreino(treinoId, { nome: '' });

    // `stripEmpty` remove qualquer campo com valor '' do payload — mesmo o
    // nome, que e a unica forma de "limpar" um nome de treino pela UI.
    // Documentado aqui como comportamento atual (ver relatorio da tarefa).
    expect(mockedPatch).toHaveBeenCalledWith(`/treinos/${treinoId}`, {});
  });
});

describe('fichaService.deleteTreino', () => {
  beforeEach(() => {
    mockedDelete.mockReset();
  });

  it('envia DELETE /treinos/:treinoId', async () => {
    mockedDelete.mockResolvedValueOnce({ data: undefined });

    await fichaService.deleteTreino(treinoId);

    expect(mockedDelete).toHaveBeenCalledWith(`/treinos/${treinoId}`);
  });
});

describe('fichaService.createItem', () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it('valida e envia POST /treinos/:treinoId/itens', async () => {
    mockedPost.mockResolvedValueOnce({ data: itemFixture });

    const resultado = await fichaService.createItem(treinoId, {
      exercicio_id: exercicioId,
      ordem: 0,
      series: 3,
      repeticoes: '8-12',
      carga_sugerida: null,
      descanso_segundos: null,
      observacao: '',
    });

    expect(mockedPost).toHaveBeenCalledWith(`/treinos/${treinoId}/itens`, {
      exercicio_id: exercicioId,
      ordem: 0,
      series: 3,
      repeticoes: '8-12',
      carga_sugerida: null,
      descanso_segundos: null,
    });
    expect(resultado).toEqual(itemFixture);
  });
});

describe('fichaService.updateItem', () => {
  beforeEach(() => {
    mockedPatch.mockReset();
  });

  it('valida e envia PATCH /itens/:itemId apenas com os campos preenchidos', async () => {
    mockedPatch.mockResolvedValueOnce({ data: itemFixture });

    const resultado = await fichaService.updateItem(itemId, { series: 4 });

    expect(mockedPatch).toHaveBeenCalledWith(`/itens/${itemId}`, { series: 4 });
    expect(resultado).toEqual(itemFixture);
  });
});

describe('fichaService.deleteItem', () => {
  beforeEach(() => {
    mockedDelete.mockReset();
  });

  it('envia DELETE /itens/:itemId', async () => {
    mockedDelete.mockResolvedValueOnce({ data: undefined });

    await fichaService.deleteItem(itemId);

    expect(mockedDelete).toHaveBeenCalledWith(`/itens/${itemId}`);
  });
});

describe('fichaService.reordenarItens', () => {
  beforeEach(() => {
    mockedPatch.mockReset();
  });

  it('valida e envia PATCH /treinos/:treinoId/itens/reordenar com a lista de ids', async () => {
    mockedPatch.mockResolvedValueOnce({ data: treinoFixture });

    const resultado = await fichaService.reordenarItens(treinoId, { ids: [itemId] });

    expect(mockedPatch).toHaveBeenCalledWith(`/treinos/${treinoId}/itens/reordenar`, {
      ids: [itemId],
    });
    expect(resultado).toEqual(treinoFixture);
  });

  it('lanca erro de validacao quando a lista de ids esta vazia', async () => {
    await expect(fichaService.reordenarItens(treinoId, { ids: [] })).rejects.toThrow();

    expect(mockedPatch).not.toHaveBeenCalled();
  });
});
