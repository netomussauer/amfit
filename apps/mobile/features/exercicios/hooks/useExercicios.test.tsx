import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useExercicio, useExercicios } from './useExercicios';
import { exercicioService } from '../services/exercicio.service';
import { makeExercicio } from '../__fixtures__/exercicio.fixtures';

jest.mock('../services/exercicio.service', () => ({
  exercicioService: {
    list: jest.fn(),
    getById: jest.fn(),
  },
}));

const mockedList = exercicioService.list as jest.MockedFunction<
  typeof exercicioService.list
>;
const mockedGetById = exercicioService.getById as jest.MockedFunction<
  typeof exercicioService.getById
>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useExercicios', () => {
  beforeEach(() => {
    mockedList.mockReset();
  });

  it('busca a lista de exercícios com os params padrão ({})', async () => {
    // Arrange
    const response = { data: [makeExercicio()] };
    mockedList.mockResolvedValue(response);

    // Act
    const { result } = renderHook(() => useExercicios(), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
    expect(mockedList).toHaveBeenCalledWith({});
  });

  it('repassa os params de filtro ao service', async () => {
    // Arrange
    const params = { grupo_muscular_id: 'grupo-1', busca: 'supino' };
    mockedList.mockResolvedValue({ data: [] });

    // Act
    const { result } = renderHook(() => useExercicios(params), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedList).toHaveBeenCalledWith(params);
  });

  it('expõe o estado de erro quando o service falha', async () => {
    // Arrange
    const error = new Error('Falha de rede');
    mockedList.mockRejectedValue(error);

    // Act
    const { result } = renderHook(() => useExercicios(), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
  });
});

describe('useExercicio', () => {
  beforeEach(() => {
    mockedGetById.mockReset();
  });

  it('não dispara a query quando id é undefined', () => {
    // Arrange / Act
    const { result } = renderHook(() => useExercicio(undefined), {
      wrapper: createWrapper(),
    });

    // Assert
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedGetById).not.toHaveBeenCalled();
  });

  it('busca o exercício quando id é informado', async () => {
    // Arrange
    const exercicio = makeExercicio({ id: 'exercicio-1' });
    mockedGetById.mockResolvedValue(exercicio);

    // Act
    const { result } = renderHook(() => useExercicio('exercicio-1'), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(exercicio);
    expect(mockedGetById).toHaveBeenCalledWith('exercicio-1');
  });
});
