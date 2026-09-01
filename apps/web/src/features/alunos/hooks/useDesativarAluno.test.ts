import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { QueryWrapper, createTestQueryClient } from '@/shared/test-utils/setup-query';
import { alunoService } from '../services/aluno.service';
import { alunoKeys } from './query-keys';
import { useDesativarAluno } from './useDesativarAluno';

vi.mock('../services/aluno.service', () => ({
  alunoService: {
    deactivate: vi.fn(),
  },
}));

const mockedDeactivate = vi.mocked(alunoService.deactivate);

describe('useDesativarAluno', () => {
  beforeEach(() => {
    mockedDeactivate.mockReset();
  });

  it('desativa o aluno e invalida o detalhe e a lista', async () => {
    mockedDeactivate.mockResolvedValueOnce(undefined);
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useDesativarAluno(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    result.current.mutate('aluno-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedDeactivate).toHaveBeenCalledWith('aluno-1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: alunoKeys.detail('aluno-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: alunoKeys.lists() });
  });

  it('expoe o AxiosError quando a mutation falha', async () => {
    const error = new AxiosError('Erro interno');
    error.response = {
      status: 500,
      data: { detail: 'erro interno' },
      statusText: 'Internal Server Error',
      headers: {},
      // @ts-expect-error -- config nao e relevante para este teste
      config: {},
    };
    mockedDeactivate.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useDesativarAluno(), { wrapper: QueryWrapper });

    result.current.mutate('aluno-1');

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.response?.status).toBe(500);
  });
});
