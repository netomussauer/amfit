import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useCriarExercicio } from './useCriarExercicio';
import { exercicioService } from '../services/exercicio.service';
import { exercicioKeys } from './query-keys';
import { makeExercicio } from '../__fixtures__/exercicio.fixtures';

jest.mock('../services/exercicio.service', () => ({
  exercicioService: {
    create: jest.fn(),
  },
}));

const mockedCreate = exercicioService.create as jest.MockedFunction<
  typeof exercicioService.create
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

describe('useCriarExercicio', () => {
  beforeEach(() => {
    mockedCreate.mockReset();
  });

  it('chama exercicioService.create com data e midia e invalida a lista de exercícios ao ter sucesso', async () => {
    // Arrange
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const exercicio = makeExercicio();
    mockedCreate.mockResolvedValue(exercicio);
    const data = { nome: 'Supino reto', grupo_muscular_id: 'grupo-1' };
    const midia = { uri: 'file:///midia.jpg', mimeType: 'image/jpeg', fileName: 'midia.jpg' };

    const { result } = renderHook(() => useCriarExercicio(), { wrapper: Wrapper });

    // Act
    act(() => {
      result.current.mutate({ data, midia });
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedCreate).toHaveBeenCalledWith(data, midia);
    expect(result.current.data).toEqual(exercicio);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: exercicioKeys.lists() });
  });

  it('expõe o estado de erro e não invalida queries quando o service falha', async () => {
    // Arrange
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const error = new Error('Falha ao criar exercício');
    mockedCreate.mockRejectedValue(error);

    const { result } = renderHook(() => useCriarExercicio(), { wrapper: Wrapper });

    // Act
    act(() => {
      result.current.mutate({
        data: { nome: 'Supino reto', grupo_muscular_id: 'grupo-1' },
        midia: null,
      });
    });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
