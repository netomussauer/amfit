import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useDesativarExercicio } from './useDesativarExercicio';
import { exercicioService } from '../services/exercicio.service';
import { exercicioKeys } from './query-keys';

jest.mock('../services/exercicio.service', () => ({
  exercicioService: {
    desativar: jest.fn(),
  },
}));

const mockedDesativar = exercicioService.desativar as jest.MockedFunction<
  typeof exercicioService.desativar
>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { Wrapper, queryClient };
}

describe('useDesativarExercicio', () => {
  beforeEach(() => {
    mockedDesativar.mockReset();
  });

  it('chama exercicioService.desativar com o id e invalida a lista + remove o detalhe ao ter sucesso', async () => {
    // Arrange
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const removeSpy = jest.spyOn(queryClient, 'removeQueries');
    mockedDesativar.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDesativarExercicio(), { wrapper: Wrapper });

    // Act
    act(() => {
      result.current.mutate('exercicio-1');
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedDesativar).toHaveBeenCalledWith('exercicio-1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: exercicioKeys.lists() });
    expect(removeSpy).toHaveBeenCalledWith({
      queryKey: exercicioKeys.detail('exercicio-1'),
    });
  });

  it('expõe o estado de erro e não invalida/remove queries quando o service falha', async () => {
    // Arrange
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const removeSpy = jest.spyOn(queryClient, 'removeQueries');
    const error = new Error('Falha ao desativar exercício');
    mockedDesativar.mockRejectedValue(error);

    const { result } = renderHook(() => useDesativarExercicio(), { wrapper: Wrapper });

    // Act
    act(() => {
      result.current.mutate('exercicio-1');
    });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(removeSpy).not.toHaveBeenCalled();
  });
});
