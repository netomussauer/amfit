import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { QueryWrapper, createTestQueryClient } from '@/shared/test-utils/setup-query';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';
import { useRemoverItem } from './useRemoverItem';

vi.mock('../services/ficha.service', () => ({
  fichaService: {
    deleteItem: vi.fn(),
  },
}));

const mockedDeleteItem = vi.mocked(fichaService.deleteItem);

describe('useRemoverItem', () => {
  beforeEach(() => {
    mockedDeleteItem.mockReset();
  });

  it('remove o item (por itemId) e invalida o detalhe da ficha (por fichaId)', async () => {
    mockedDeleteItem.mockResolvedValueOnce(undefined);
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useRemoverItem(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    result.current.mutate({ fichaId: 'ficha-1', itemId: 'item-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedDeleteItem).toHaveBeenCalledWith('item-1');
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
    mockedDeleteItem.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useRemoverItem(), { wrapper: QueryWrapper });

    result.current.mutate({ fichaId: 'ficha-1', itemId: 'item-1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
