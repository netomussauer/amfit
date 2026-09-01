import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { TreinoResponse } from '@amfit/shared';
import { QueryWrapper, createTestQueryClient } from '@/shared/test-utils/setup-query';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';
import { useCriarTreino } from './useCriarTreino';

vi.mock('../services/ficha.service', () => ({
  fichaService: {
    createTreino: vi.fn(),
  },
}));

const mockedCreateTreino = vi.mocked(fichaService.createTreino);

const treinoFixture: TreinoResponse = {
  id: 'treino-1',
  letra: 'A',
  ordem: 0,
  itens: [],
};

describe('useCriarTreino', () => {
  beforeEach(() => {
    mockedCreateTreino.mockReset();
  });

  it('cria o treino e invalida o detalhe da ficha', async () => {
    mockedCreateTreino.mockResolvedValueOnce(treinoFixture);
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useCriarTreino(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    result.current.mutate({ fichaId: 'ficha-1', payload: { letra: 'A', ordem: 0 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedCreateTreino).toHaveBeenCalledWith('ficha-1', { letra: 'A', ordem: 0 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: fichaKeys.detail('ficha-1') });
  });

  it('expoe o AxiosError quando a mutation falha', async () => {
    const error = new AxiosError('Unprocessable Entity');
    error.response = {
      status: 422,
      data: { detail: 'letra inválida' },
      statusText: 'Unprocessable Entity',
      headers: {},
      // @ts-expect-error -- config nao e relevante para este teste
      config: {},
    };
    mockedCreateTreino.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useCriarTreino(), { wrapper: QueryWrapper });

    result.current.mutate({ fichaId: 'ficha-1', payload: { letra: 'A', ordem: 0 } });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
