import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { QueryWrapper, createTestQueryClient } from '@/shared/test-utils/setup-query';
import { exercicioService } from '../services/exercicio.service';
import { exercicioKeys } from './query-keys';
import { useDesativarExercicio } from './useDesativarExercicio';

vi.mock('../services/exercicio.service', () => ({
  exercicioService: {
    delete: vi.fn(),
  },
}));

const mockedDelete = vi.mocked(exercicioService.delete);

const exercicioId = '22222222-2222-2222-2222-222222222222';

describe('useDesativarExercicio', () => {
  beforeEach(() => {
    mockedDelete.mockReset();
  });

  it('remove o exercicio e invalida o cache de detalhe e de listagem', async () => {
    mockedDelete.mockResolvedValueOnce(undefined);
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useDesativarExercicio(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    result.current.mutate(exercicioId);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedDelete).toHaveBeenCalledWith(exercicioId);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: exercicioKeys.detail(exercicioId),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: exercicioKeys.lists() });
  });

  it('expoe o AxiosError quando a mutation falha (ex.: 409 de exercicio em uso)', async () => {
    const error = new AxiosError('Conflict');
    error.response = {
      status: 409,
      data: { detail: 'exercício em uso em fichas' },
      statusText: 'Conflict',
      headers: {},
      // @ts-expect-error -- config nao e relevante para este teste
      config: {},
    };
    mockedDelete.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useDesativarExercicio(), { wrapper: QueryWrapper });

    result.current.mutate(exercicioId);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.response?.status).toBe(409);
  });
});
