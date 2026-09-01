import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { TreinoResponse } from '@amfit/shared';
import { QueryWrapper, createTestQueryClient } from '@/shared/test-utils/setup-query';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';
import { useAtualizarTreino } from './useAtualizarTreino';

vi.mock('../services/ficha.service', () => ({
  fichaService: {
    updateTreino: vi.fn(),
  },
}));

const mockedUpdateTreino = vi.mocked(fichaService.updateTreino);

const treinoFixture: TreinoResponse = {
  id: 'treino-1',
  letra: 'A',
  nome: 'Peito e tríceps',
  ordem: 0,
  itens: [],
};

describe('useAtualizarTreino', () => {
  beforeEach(() => {
    mockedUpdateTreino.mockReset();
  });

  it('atualiza o treino (por treinoId) e invalida o detalhe da ficha (por fichaId)', async () => {
    mockedUpdateTreino.mockResolvedValueOnce(treinoFixture);
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useAtualizarTreino(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    result.current.mutate({
      fichaId: 'ficha-1',
      treinoId: 'treino-1',
      payload: { nome: 'Peito e tríceps' },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedUpdateTreino).toHaveBeenCalledWith('treino-1', { nome: 'Peito e tríceps' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: fichaKeys.detail('ficha-1') });
  });

  it('expoe o AxiosError quando a mutation falha', async () => {
    const error = new AxiosError('Unprocessable Entity');
    error.response = {
      status: 422,
      data: {},
      statusText: 'Unprocessable Entity',
      headers: {},
      // @ts-expect-error -- config nao e relevante para este teste
      config: {},
    };
    mockedUpdateTreino.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useAtualizarTreino(), { wrapper: QueryWrapper });

    result.current.mutate({ fichaId: 'ficha-1', treinoId: 'treino-1', payload: {} });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
