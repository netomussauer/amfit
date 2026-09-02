import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useMinhasSessoes } from './useMinhasSessoes';
import { execucaoService } from '../services/execucao.service';
import { makeSessaoListResponse } from '../__fixtures__/execucao.fixtures';

jest.mock('../services/execucao.service', () => ({
  execucaoService: {
    listarMinhasSessoes: jest.fn(),
  },
}));

const mockedListar = execucaoService.listarMinhasSessoes as jest.MockedFunction<
  typeof execucaoService.listarMinhasSessoes
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

describe('useMinhasSessoes', () => {
  beforeEach(() => {
    mockedListar.mockReset();
  });

  it('busca a primeira página com o tamanho padrão quando nenhum argumento é informado', async () => {
    // Arrange
    const response = makeSessaoListResponse();
    mockedListar.mockResolvedValue(response);

    // Act
    const { result } = renderHook(() => useMinhasSessoes(), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedListar).toHaveBeenCalledWith(1, 20);
    expect(result.current.data).toEqual(response);
  });

  it('repassa page e perPage informados ao service', async () => {
    // Arrange
    const response = makeSessaoListResponse({
      pagination: { total: 30, page: 2, per_page: 10 },
    });
    mockedListar.mockResolvedValue(response);

    // Act
    const { result } = renderHook(() => useMinhasSessoes(2, 10), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedListar).toHaveBeenCalledWith(2, 10);
  });

  it('expõe o estado de erro quando o service falha', async () => {
    // Arrange
    const error = new Error('Falha ao listar sessões');
    mockedListar.mockRejectedValue(error);

    // Act
    const { result } = renderHook(() => useMinhasSessoes(), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
  });
});
