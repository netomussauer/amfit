import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { QueryWrapper, createTestQueryClient } from '@/shared/test-utils/setup-query';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';
import { useRemoverTreino } from './useRemoverTreino';

vi.mock('../services/ficha.service', () => ({
  fichaService: {
    deleteTreino: vi.fn(),
  },
}));

const mockedDeleteTreino = vi.mocked(fichaService.deleteTreino);

describe('useRemoverTreino', () => {
  beforeEach(() => {
    mockedDeleteTreino.mockReset();
  });

  it('remove o treino (por treinoId) e invalida o detalhe da ficha (por fichaId)', async () => {
    mockedDeleteTreino.mockResolvedValueOnce(undefined);
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useRemoverTreino(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    result.current.mutate({ fichaId: 'ficha-1', treinoId: 'treino-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedDeleteTreino).toHaveBeenCalledWith('treino-1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: fichaKeys.detail('ficha-1') });
  });

  it('expoe o AxiosError quando a mutation falha', async () => {
    const error = new AxiosError('Erro interno');
    error.response = {
      status: 500,
      data: {},
      statusText: 'Internal Server Error',
      headers: {},
      // @ts-expect-error -- config nao e relevante para este teste
      config: {},
    };
    mockedDeleteTreino.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useRemoverTreino(), { wrapper: QueryWrapper });

    result.current.mutate({ fichaId: 'ficha-1', treinoId: 'treino-1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
