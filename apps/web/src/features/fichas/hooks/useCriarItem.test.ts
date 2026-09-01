import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { ItemTreinoResponse } from '@amfit/shared';
import { QueryWrapper, createTestQueryClient } from '@/shared/test-utils/setup-query';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';
import { useCriarItem } from './useCriarItem';

vi.mock('../services/ficha.service', () => ({
  fichaService: {
    createItem: vi.fn(),
  },
}));

const mockedCreateItem = vi.mocked(fichaService.createItem);

const itemFixture: ItemTreinoResponse = {
  id: 'item-1',
  ordem: 0,
  exercicio: {
    id: 'exercicio-1',
    nome: 'Supino reto',
    grupo_muscular: { id: 'grupo-1', nome: 'Peito' },
    is_global: true,
  },
  series: 3,
  repeticoes: '8-12',
};

describe('useCriarItem', () => {
  beforeEach(() => {
    mockedCreateItem.mockReset();
  });

  it('cria o item (por treinoId) e invalida o detalhe da ficha (por fichaId)', async () => {
    mockedCreateItem.mockResolvedValueOnce(itemFixture);
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useCriarItem(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    const payload = {
      exercicio_id: 'exercicio-1',
      ordem: 0,
      series: 3,
      repeticoes: '8-12',
    };
    result.current.mutate({ fichaId: 'ficha-1', treinoId: 'treino-1', payload });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedCreateItem).toHaveBeenCalledWith('treino-1', payload);
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
    mockedCreateItem.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useCriarItem(), { wrapper: QueryWrapper });

    result.current.mutate({
      fichaId: 'ficha-1',
      treinoId: 'treino-1',
      payload: { exercicio_id: 'exercicio-1', ordem: 0, series: 3, repeticoes: '8-12' },
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
