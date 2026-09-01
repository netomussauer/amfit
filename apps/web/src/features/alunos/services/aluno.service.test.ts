import { beforeEach, describe, expect, it, vi } from 'vitest';
import { alunoService } from './aluno.service';

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

const alunoFixture = {
  id: '11111111-1111-1111-1111-111111111111',
  nome: 'João Silva',
  email: 'joao@aluno.app',
  telefone: '(11) 99999-9999',
  data_nascimento: '2000-05-10',
  sexo: 'M' as const,
  ativo: true,
  criado_em: '2026-05-11T16:46:15Z',
};

const alunoListFixture = {
  data: [alunoFixture],
  pagination: { total: 1, page: 1, per_page: 20 },
};

describe('alunoService.list', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('busca /alunos com page e per_page, omitindo ativo quando nao informado', async () => {
    mockedGet.mockResolvedValueOnce({ data: alunoListFixture });

    const resultado = await alunoService.list({ page: 1, perPage: 20 });

    expect(mockedGet).toHaveBeenCalledWith('/alunos', {
      params: { page: 1, per_page: 20 },
    });
    expect(resultado).toEqual(alunoListFixture);
  });

  it('inclui ativo na query quando informado como booleano', async () => {
    mockedGet.mockResolvedValueOnce({ data: alunoListFixture });

    await alunoService.list({ page: 2, perPage: 20, ativo: true });

    expect(mockedGet).toHaveBeenCalledWith('/alunos', {
      params: { page: 2, per_page: 20, ativo: true },
    });
  });

  it('inclui ativo: false na query (nao trata false como ausente)', async () => {
    mockedGet.mockResolvedValueOnce({ data: alunoListFixture });

    await alunoService.list({ page: 1, perPage: 20, ativo: false });

    expect(mockedGet).toHaveBeenCalledWith('/alunos', {
      params: { page: 1, per_page: 20, ativo: false },
    });
  });

  it('lanca erro de validacao quando a resposta da API nao bate com o schema', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: [{ ...alunoFixture, email: 'nao-e-um-email' }], pagination: alunoListFixture.pagination },
    });

    await expect(alunoService.list({ page: 1, perPage: 20 })).rejects.toThrow();
  });
});

describe('alunoService.getById', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('busca /alunos/:id e retorna os dados quando a resposta e valida', async () => {
    mockedGet.mockResolvedValueOnce({ data: alunoFixture });

    const resultado = await alunoService.getById(alunoFixture.id);

    expect(mockedGet).toHaveBeenCalledWith(`/alunos/${alunoFixture.id}`);
    expect(resultado).toEqual(alunoFixture);
  });

  it('lanca erro de validacao quando a resposta da API nao bate com o schema', async () => {
    mockedGet.mockResolvedValueOnce({ data: { ...alunoFixture, ativo: 'sim' } });

    await expect(alunoService.getById(alunoFixture.id)).rejects.toThrow();
  });
});

describe('alunoService.create', () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it('envia POST /alunos removendo campos vazios/undefined do payload', async () => {
    mockedPost.mockResolvedValueOnce({ data: alunoFixture });

    const resultado = await alunoService.create({
      nome: 'João Silva',
      email: 'joao@aluno.app',
      senha: 'senhaSegura123',
      telefone: '',
      data_nascimento: '2000-05-10',
      sexo: undefined,
    });

    expect(mockedPost).toHaveBeenCalledWith('/alunos', {
      nome: 'João Silva',
      email: 'joao@aluno.app',
      senha: 'senhaSegura123',
      data_nascimento: '2000-05-10',
    });
    expect(resultado).toEqual(alunoFixture);
  });
});

describe('alunoService.update', () => {
  beforeEach(() => {
    mockedPatch.mockReset();
  });

  it('envia PATCH /alunos/:id apenas com os campos preenchidos', async () => {
    mockedPatch.mockResolvedValueOnce({ data: alunoFixture });

    const resultado = await alunoService.update(alunoFixture.id, {
      nome: 'João Silva',
      email: 'joao@aluno.app',
      telefone: '',
      data_nascimento: '',
      sexo: undefined,
    });

    expect(mockedPatch).toHaveBeenCalledWith(`/alunos/${alunoFixture.id}`, {
      nome: 'João Silva',
      email: 'joao@aluno.app',
    });
    expect(resultado).toEqual(alunoFixture);
  });
});

describe('alunoService.deactivate', () => {
  beforeEach(() => {
    mockedDelete.mockReset();
  });

  it('envia DELETE /alunos/:id e nao retorna dados', async () => {
    mockedDelete.mockResolvedValueOnce({ data: undefined });

    const resultado = await alunoService.deactivate(alunoFixture.id);

    expect(mockedDelete).toHaveBeenCalledWith(`/alunos/${alunoFixture.id}`);
    expect(resultado).toBeUndefined();
  });
});
