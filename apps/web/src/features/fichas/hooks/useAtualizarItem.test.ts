import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { ItemTreinoResponse } from '@amfit/shared';
import { QueryWrapper, createTestQueryClient } from '@/shared/test-utils/setup-query';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';
import { useAtualizarItem } from './useAtualizarItem';

vi.mock('../services/ficha.service', () => ({
  fichaService: {
    updateItem: vi.fn(),
  },
}));

const mockedUpdateItem = vi.mocked(fichaService.updateItem);

const itemFixture: ItemTreinoResponse = {
  id: 'item-1',
  ordem: 0,
  exercicio: {
    id: 'exercicio-1',
    nome: 'Supino reto',
    grupo_muscular: { id: 'grupo-1', nome: 'Peito' },
    is_global: true,
  },
  series: 4,
  repeticoes: '6-10',
};

describe('useAtualizarItem', () => {
  beforeEach(() => {
    mockedUpdateItem.mockReset();
  });

  it('atualiza o item (por itemId) e invalida o detalhe da ficha (por fichaId)', async () => {
    mockedUpdateItem.mockResolvedValueOnce(itemFixture);
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useAtualizarItem(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    result.current.mutate({
      fichaId: 'ficha-1',
      itemId: 'item-1',
      payload: { series: 4 },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedUpdateItem).toHaveBeenCalledWith('item-1', { series: 4 });
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
    mockedUpdateItem.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useAtualizarItem(), { wrapper: QueryWrapper });

    result.current.mutate({ fichaId: 'ficha-1', itemId: 'item-1', payload: { series: 4 } });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
