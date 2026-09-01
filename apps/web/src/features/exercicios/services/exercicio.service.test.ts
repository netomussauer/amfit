import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exercicioService } from './exercicio.service';

// `apiClient.*` (axios) tem uma assinatura fortemente sobrecarregada que
// dificulta tipar um mock diretamente contra `AxiosResponse`. Como o service
// so usa `{ data }` da resposta, criamos o mock via `vi.hoisted` e o service
// so enxerga um objeto `{ data: ... }`, exatamente como a lib real devolve.
const { mockedGet, mockedPost, mockedPatch, mockedDelete } = vi.hoisted(() => ({
  mockedGet: vi.fn(),
  mockedPost: vi.fn(),
  mockedPatch: vi.fn(),
  mockedDelete: vi.fn(),
}));

vi.mock('@/shared/lib/api-client', () => ({
  apiClient: { get: mockedGet, post: mockedPost, patch: mockedPatch, delete: mockedDelete },
}));

const grupoFixture = { id: '11111111-1111-1111-1111-111111111111', nome: 'Peito' };

const exercicioFixture = {
  id: '22222222-2222-2222-2222-222222222222',
  nome: 'Supino reto',
  descricao: 'Deitado no banco...',
  grupo_muscular: grupoFixture,
  midia_url: 'https://cdn.amfit.app/midia/supino.jpg',
  tipo_midia: 'IMAGEM' as const,
  is_global: false,
};

describe('exercicioService.listGrupos', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('busca /grupos-musculares e retorna o array quando a resposta e valida', async () => {
    mockedGet.mockResolvedValueOnce({ data: [grupoFixture] });

    const resultado = await exercicioService.listGrupos();

    expect(mockedGet).toHaveBeenCalledWith('/grupos-musculares');
    expect(resultado).toEqual([grupoFixture]);
  });

  it('lanca erro de validacao quando a resposta nao bate com o schema', async () => {
    mockedGet.mockResolvedValueOnce({ data: [{ id: 'nao-e-uuid', nome: 'Peito' }] });

    await expect(exercicioService.listGrupos()).rejects.toThrow();
  });
});

describe('exercicioService.list', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('envia apenas os params preenchidos (grupo_muscular_id e busca trimada)', async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: [exercicioFixture] } });

    const resultado = await exercicioService.list({
      grupo_muscular_id: grupoFixture.id,
      busca: '  supino  ',
    });

    expect(mockedGet).toHaveBeenCalledWith('/exercicios', {
      params: { grupo_muscular_id: grupoFixture.id, busca: 'supino' },
    });
    expect(resultado).toEqual({ data: [exercicioFixture] });
  });

  it('nao envia busca quando ela e apenas espacos em branco', async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: [] } });

    await exercicioService.list({ busca: '   ' });

    expect(mockedGet).toHaveBeenCalledWith('/exercicios', { params: {} });
  });

  it('nao envia nenhum param quando a lista de filtros esta vazia', async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: [] } });

    await exercicioService.list({});

    expect(mockedGet).toHaveBeenCalledWith('/exercicios', { params: {} });
  });
});

describe('exercicioService.getById', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('busca /exercicios/:id e retorna os dados quando a resposta e valida', async () => {
    mockedGet.mockResolvedValueOnce({ data: exercicioFixture });

    const resultado = await exercicioService.getById(exercicioFixture.id);

    expect(mockedGet).toHaveBeenCalledWith(`/exercicios/${exercicioFixture.id}`);
    expect(resultado).toEqual(exercicioFixture);
  });

  it('lanca erro de validacao quando a resposta nao bate com o schema', async () => {
    mockedGet.mockResolvedValueOnce({ data: { ...exercicioFixture, is_global: 'nao-e-bool' } });

    await expect(exercicioService.getById(exercicioFixture.id)).rejects.toThrow();
  });
});

describe('exercicioService.create', () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it('monta um FormData com nome, grupo_muscular_id, descricao e midia e envia como multipart', async () => {
    mockedPost.mockResolvedValueOnce({ data: exercicioFixture });
    const midia = new File(['conteudo'], 'foto.jpg', { type: 'image/jpeg' });

    const resultado = await exercicioService.create(
      { nome: 'Supino reto', grupo_muscular_id: grupoFixture.id, descricao: 'Instruções' },
      midia,
    );

    expect(mockedPost).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockedPost.mock.calls[0];
    expect(url).toBe('/exercicios');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('nome')).toBe('Supino reto');
    expect((body as FormData).get('grupo_muscular_id')).toBe(grupoFixture.id);
    expect((body as FormData).get('descricao')).toBe('Instruções');
    expect((body as FormData).get('midia')).toBe(midia);
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
    expect(resultado).toEqual(exercicioFixture);
  });

  it('omite descricao e midia do FormData quando ausentes', async () => {
    mockedPost.mockResolvedValueOnce({ data: exercicioFixture });

    await exercicioService.create(
      { nome: 'Supino reto', grupo_muscular_id: grupoFixture.id },
      null,
    );

    const [, body] = mockedPost.mock.calls[0];
    expect((body as FormData).get('descricao')).toBeNull();
    expect((body as FormData).get('midia')).toBeNull();
  });
});

describe('exercicioService.update', () => {
  beforeEach(() => {
    mockedPatch.mockReset();
  });

  it('envia PATCH /exercicios/:id apenas com os campos preenchidos', async () => {
    mockedPatch.mockResolvedValueOnce({ data: exercicioFixture });

    const resultado = await exercicioService.update(exercicioFixture.id, {
      nome: 'Supino inclinado',
      grupo_muscular_id: undefined,
      descricao: '',
    });

    expect(mockedPatch).toHaveBeenCalledWith(`/exercicios/${exercicioFixture.id}`, {
      nome: 'Supino inclinado',
    });
    expect(resultado).toEqual(exercicioFixture);
  });
});

describe('exercicioService.delete', () => {
  beforeEach(() => {
    mockedDelete.mockReset();
  });

  it('envia DELETE /exercicios/:id sem retornar dados', async () => {
    mockedDelete.mockResolvedValueOnce({ data: undefined });

    const resultado = await exercicioService.delete(exercicioFixture.id);

    expect(mockedDelete).toHaveBeenCalledWith(`/exercicios/${exercicioFixture.id}`);
    expect(resultado).toBeUndefined();
  });
});
