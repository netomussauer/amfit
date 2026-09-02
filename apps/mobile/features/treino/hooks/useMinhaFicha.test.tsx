import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useMinhaFicha } from './useMinhaFicha';
import { treinoService } from '../services/treino.service';
import { ApiError } from '@/shared/lib/api-client';
import { makeFicha } from '../__fixtures__/treino.fixtures';

jest.mock('../services/treino.service', () => ({
  treinoService: {
    getMinhaFicha: jest.fn(),
  },
}));

const mockedGetMinhaFicha = treinoService.getMinhaFicha as jest.MockedFunction<
  typeof treinoService.getMinhaFicha
>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0 } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useMinhaFicha', () => {
  beforeEach(() => {
    mockedGetMinhaFicha.mockReset();
  });

  it('busca a ficha ativa e expõe os dados retornados', async () => {
    // Arrange
    const ficha = makeFicha();
    mockedGetMinhaFicha.mockResolvedValue(ficha);

    // Act
    const { result } = renderHook(() => useMinhaFicha(), { wrapper: createWrapper() });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(ficha);
  });

  it('não retenta a busca quando a API responde 404 (sem ficha ativa)', async () => {
    // Arrange
    const error = new ApiError(404, 'Ficha não encontrada');
    mockedGetMinhaFicha.mockRejectedValue(error);

    // Act
    const { result } = renderHook(() => useMinhaFicha(), { wrapper: createWrapper() });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
    // Uma única chamada — sem retry para 404 (comportamento esperado, ver retry() do hook).
    expect(mockedGetMinhaFicha).toHaveBeenCalledTimes(1);
  });
});
