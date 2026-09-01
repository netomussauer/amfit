import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { QueryWrapper, createTestQueryClient } from '@/shared/test-utils/setup-query';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';
import { useDesativarFicha } from './useDesativarFicha';

vi.mock('../services/ficha.service', () => ({
  fichaService: {
    deactivate: vi.fn(),
  },
}));

const mockedDeactivate = vi.mocked(fichaService.deactivate);

describe('useDesativarFicha', () => {
  beforeEach(() => {
    mockedDeactivate.mockReset();
  });

  it('desativa a ficha e invalida o detalhe e a lista', async () => {
    mockedDeactivate.mockResolvedValueOnce(undefined);
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useDesativarFicha(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    result.current.mutate('ficha-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedDeactivate).toHaveBeenCalledWith('ficha-1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: fichaKeys.detail('ficha-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: fichaKeys.lists() });
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

    const { result } = renderHook(() => useDesativarFicha(), { wrapper: QueryWrapper });

    result.current.mutate('ficha-1');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
