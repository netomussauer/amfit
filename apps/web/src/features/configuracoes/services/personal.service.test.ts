import { beforeEach, describe, expect, it, vi } from 'vitest';
import { personalService } from './personal.service';

// `apiClient.get/patch` (axios) tem uma assinatura fortemente sobrecarregada
// (generics para o payload de resposta) que dificulta tipar um mock
// diretamente contra `AxiosResponse`. Como o service so usa `{ data }` da
// resposta, criamos o mock via `vi.hoisted` e o service so enxerga um
// objeto `{ data: ... }`, exatamente como a lib real devolve.
const { mockedGet, mockedPatch } = vi.hoisted(() => ({
  mockedGet: vi.fn(),
  mockedPatch: vi.fn(),
}));

vi.mock('@/shared/lib/api-client', () => ({
  apiClient: { get: mockedGet, patch: mockedPatch },
}));

const personalFixture = {
  id: '11111111-1111-1111-1111-111111111111',
  nome: 'João Personal',
  email: 'joao@amfit.app',
  telefone: '(11) 99999-9999',
  cref: '000000-G/SP',
  ativo: true,
  criado_em: '2026-05-11T16:46:15Z',
};

describe('personalService.getMinhaConta', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('busca /personal/me e retorna os dados quando a resposta e valida', async () => {
    mockedGet.mockResolvedValueOnce({ data: personalFixture });

    const resultado = await personalService.getMinhaConta();

    expect(mockedGet).toHaveBeenCalledWith('/personal/me');
    expect(resultado).toEqual(personalFixture);
  });

  it('lanca erro de validacao quando a resposta da API nao bate com o schema', async () => {
    mockedGet.mockResolvedValueOnce({
      data: { ...personalFixture, email: 'nao-e-um-email' },
    });

    await expect(personalService.getMinhaConta()).rejects.toThrow();
  });
});

describe('personalService.atualizarMinhaConta', () => {
  beforeEach(() => {
    mockedPatch.mockReset();
  });

  it('envia PATCH /personal/me apenas com os campos preenchidos', async () => {
    mockedPatch.mockResolvedValueOnce({ data: personalFixture });

    const resultado = await personalService.atualizarMinhaConta({
      nome: 'João Personal',
      email: 'joao@amfit.app',
      telefone: '',
      cref: '',
    });

    expect(mockedPatch).toHaveBeenCalledWith('/personal/me', {
      nome: 'João Personal',
      email: 'joao@amfit.app',
    });
    expect(resultado).toEqual(personalFixture);
  });
});

describe('personalService.alterarMinhaSenha', () => {
  beforeEach(() => {
    mockedPatch.mockReset();
  });

  it('envia PATCH /personal/me/senha com senha_atual e nova_senha', async () => {
    mockedPatch.mockResolvedValueOnce({ data: undefined });

    await personalService.alterarMinhaSenha({
      senha_atual: 'senhaAntiga123',
      nova_senha: 'senhaNova12345',
    });

    expect(mockedPatch).toHaveBeenCalledWith('/personal/me/senha', {
      senha_atual: 'senhaAntiga123',
      nova_senha: 'senhaNova12345',
    });
  });
});
