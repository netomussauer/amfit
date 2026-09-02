import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useTreinoHoje } from './useTreinoHoje';
import { treinoService } from '../services/treino.service';
import { makeTreinoHoje } from '../__fixtures__/treino.fixtures';

jest.mock('../services/treino.service', () => ({
  treinoService: {
    getTreinoHoje: jest.fn(),
  },
}));

const mockedGetTreinoHoje = treinoService.getTreinoHoje as jest.MockedFunction<
  typeof treinoService.getTreinoHoje
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

describe('useTreinoHoje', () => {
  beforeEach(() => {
    mockedGetTreinoHoje.mockReset();
  });

  it('busca o treino de hoje e expõe os dados retornados', async () => {
    // Arrange
    const response = makeTreinoHoje();
    mockedGetTreinoHoje.mockResolvedValue(response);

    // Act
    const { result } = renderHook(() => useTreinoHoje(), { wrapper: createWrapper() });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
    expect(mockedGetTreinoHoje).toHaveBeenCalledTimes(1);
  });

  it('expõe data null quando não há treino agendado para hoje', async () => {
    // Arrange
    mockedGetTreinoHoje.mockResolvedValue(null);

    // Act
    const { result } = renderHook(() => useTreinoHoje(), { wrapper: createWrapper() });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('expõe o estado de erro quando o service falha', async () => {
    // Arrange
    const error = new Error('Falha de rede');
    mockedGetTreinoHoje.mockRejectedValue(error);

    // Act
    const { result } = renderHook(() => useTreinoHoje(), { wrapper: createWrapper() });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
  });
});
