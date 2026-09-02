import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useSessao } from './useSessao';
import { execucaoService } from '../services/execucao.service';
import { makeSessaoResponse } from '../__fixtures__/execucao.fixtures';

jest.mock('../services/execucao.service', () => ({
  execucaoService: {
    buscar: jest.fn(),
  },
}));

const mockedBuscar = execucaoService.buscar as jest.MockedFunction<
  typeof execucaoService.buscar
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

describe('useSessao', () => {
  beforeEach(() => {
    mockedBuscar.mockReset();
  });

  it('não dispara a query quando sessaoId é undefined', () => {
    // Arrange / Act
    const { result } = renderHook(() => useSessao(undefined), {
      wrapper: createWrapper(),
    });

    // Assert
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(mockedBuscar).not.toHaveBeenCalled();
  });

  it('busca a sessão quando sessaoId é informado e expõe os dados retornados', async () => {
    // Arrange
    const sessao = makeSessaoResponse();
    mockedBuscar.mockResolvedValue(sessao);

    // Act
    const { result } = renderHook(() => useSessao(sessao.id), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sessao);
    expect(mockedBuscar).toHaveBeenCalledWith(sessao.id);
  });

  it('expõe o estado de erro quando o service falha', async () => {
    // Arrange
    const error = new Error('Falha ao buscar sessão');
    mockedBuscar.mockRejectedValue(error);

    // Act
    const { result } = renderHook(
      () => useSessao('50000000-0000-0000-0000-000000000001'),
      { wrapper: createWrapper() },
    );

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
  });
});
