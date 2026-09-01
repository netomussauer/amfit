import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { AlunoResponse } from '@amfit/shared';
import { QueryWrapper, createTestQueryClient } from '@/shared/test-utils/setup-query';
import { alunoService } from '../services/aluno.service';
import { alunoKeys } from './query-keys';
import { useCriarAluno } from './useCriarAluno';

vi.mock('../services/aluno.service', () => ({
  alunoService: {
    create: vi.fn(),
  },
}));

const mockedCreate = vi.mocked(alunoService.create);

const alunoFixture: AlunoResponse = {
  id: 'aluno-1',
  nome: 'João Silva',
  email: 'joao@aluno.app',
  ativo: true,
  criado_em: '2026-05-11T16:46:15Z',
};

describe('useCriarAluno', () => {
  beforeEach(() => {
    mockedCreate.mockReset();
  });

  it('cria o aluno e invalida a lista de alunos', async () => {
    mockedCreate.mockResolvedValueOnce(alunoFixture);
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useCriarAluno(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    const payload = {
      nome: 'João Silva',
      email: 'joao@aluno.app',
      senha: 'senhaSegura123',
    };
    result.current.mutate(payload);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedCreate).toHaveBeenCalledWith(payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: alunoKeys.lists() });
  });

  it('expoe o AxiosError quando a mutation falha (ex.: 409 de e-mail duplicado)', async () => {
    const error = new AxiosError('Conflict');
    error.response = {
      status: 409,
      data: { detail: 'email já cadastrado' },
      statusText: 'Conflict',
      headers: {},
      // @ts-expect-error -- config nao e relevante para este teste
      config: {},
    };
    mockedCreate.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useCriarAluno(), { wrapper: QueryWrapper });

    result.current.mutate({
      nome: 'João Silva',
      email: 'duplicado@aluno.app',
      senha: 'senhaSegura123',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.response?.status).toBe(409);
  });
});
