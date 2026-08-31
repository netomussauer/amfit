import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useMeuProgresso } from './useMeuProgresso';
import { progressoService } from '../services/progresso.service';
import { makeHistoricoExercicioResponse } from '../__fixtures__/progresso.fixtures';

jest.mock('../services/progresso.service', () => ({
  progressoService: {
    getMeuProgresso: jest.fn(),
  },
}));

const mockedGetMeuProgresso =
  progressoService.getMeuProgresso as jest.MockedFunction<
    typeof progressoService.getMeuProgresso
  >;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useMeuProgresso', () => {
  beforeEach(() => {
    mockedGetMeuProgresso.mockReset();
  });

  it('não dispara a query quando exercicioId é undefined', () => {
    // Arrange / Act
    const { result } = renderHook(() => useMeuProgresso(undefined), {
      wrapper: createWrapper(),
    });

    // Assert
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(mockedGetMeuProgresso).not.toHaveBeenCalled();
  });

  it('busca o progresso quando exercicioId é informado e expõe os dados retornados', async () => {
    // Arrange
    const exercicioId = '33333333-3333-3333-3333-333333333333';
    const response = makeHistoricoExercicioResponse({ exercicio_id: exercicioId });
    mockedGetMeuProgresso.mockResolvedValue(response);

    // Act
    const { result } = renderHook(() => useMeuProgresso(exercicioId), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
    expect(mockedGetMeuProgresso).toHaveBeenCalledWith(exercicioId, undefined);
  });

  it('repassa os params opcionais ao service', async () => {
    // Arrange
    const exercicioId = '33333333-3333-3333-3333-333333333333';
    const params = { from: '2026-01-01' };
    mockedGetMeuProgresso.mockResolvedValue(makeHistoricoExercicioResponse());

    // Act
    const { result } = renderHook(() => useMeuProgresso(exercicioId, params), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetMeuProgresso).toHaveBeenCalledWith(exercicioId, params);
  });

  it('expõe o estado de erro quando o service falha', async () => {
    // Arrange
    const exercicioId = '33333333-3333-3333-3333-333333333333';
    const error = new Error('Falha de rede');
    mockedGetMeuProgresso.mockRejectedValue(error);

    // Act
    const { result } = renderHook(() => useMeuProgresso(exercicioId), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
  });
});
