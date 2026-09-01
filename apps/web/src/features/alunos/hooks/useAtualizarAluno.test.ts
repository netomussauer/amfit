import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { AlunoResponse } from '@amfit/shared';
import { QueryWrapper, createTestQueryClient } from '@/shared/test-utils/setup-query';
import { alunoService } from '../services/aluno.service';
import { alunoKeys } from './query-keys';
import { useAtualizarAluno } from './useAtualizarAluno';

vi.mock('../services/aluno.service', () => ({
  alunoService: {
    update: vi.fn(),
  },
}));

const mockedUpdate = vi.mocked(alunoService.update);

const alunoFixture: AlunoResponse = {
  id: 'aluno-1',
  nome: 'João Silva',
  email: 'joao@aluno.app',
  ativo: true,
  criado_em: '2026-05-11T16:46:15Z',
};

describe('useAtualizarAluno', () => {
  beforeEach(() => {
    mockedUpdate.mockReset();
  });

  it('atualiza o aluno, popula o cache do detalhe e invalida a lista', async () => {
    mockedUpdate.mockResolvedValueOnce({ ...alunoFixture, nome: 'João Atualizado' });
    const client = createTestQueryClient();
    const setQueryDataSpy = vi.spyOn(client, 'setQueryData');
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useAtualizarAluno(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    result.current.mutate({ id: 'aluno-1', payload: { nome: 'João Atualizado' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedUpdate).toHaveBeenCalledWith('aluno-1', { nome: 'João Atualizado' });
    expect(setQueryDataSpy).toHaveBeenCalledWith(alunoKeys.detail('aluno-1'), {
      ...alunoFixture,
      nome: 'João Atualizado',
    });
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
    mockedUpdate.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useAtualizarAluno(), { wrapper: QueryWrapper });

    result.current.mutate({ id: 'aluno-1', payload: { email: 'duplicado@aluno.app' } });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.response?.status).toBe(409);
  });
});
