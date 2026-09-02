import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useIniciarSessao } from './useIniciarSessao';
import { execucaoService } from '../services/execucao.service';
import { sessaoKeys } from './query-keys';
import { treinoKeys } from '@/features/treino/hooks/query-keys';
import { makeSessaoResponse } from '../__fixtures__/execucao.fixtures';

jest.mock('../services/execucao.service', () => ({
  execucaoService: {
    iniciar: jest.fn(),
  },
}));

const mockedIniciar = execucaoService.iniciar as jest.MockedFunction<
  typeof execucaoService.iniciar
>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      // gcTime padrão (não 0): o cache da sessão é escrito via
      // `setQueryData` no onSuccess da mutation sem nenhum observer ativo
      // (nenhum `useSessao` montado no teste) — com gcTime 0 o React Query
      // agenda a coleta quase imediata dessa entrada, apagando o dado antes
      // da asserção rodar.
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const Wrapper = function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  return { queryClient, Wrapper };
}

describe('useIniciarSessao', () => {
  beforeEach(() => {
    mockedIniciar.mockReset();
  });

  it('chama o service com o treino_id informado', async () => {
    // Arrange
    const sessao = makeSessaoResponse();
    mockedIniciar.mockResolvedValue(sessao);
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useIniciarSessao(), { wrapper: Wrapper });

    // Act
    act(() => {
      result.current.mutate({ treino_id: sessao.treino_id });
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedIniciar).toHaveBeenCalledWith(sessao.treino_id);
  });

  it('popula o cache da sessão e invalida o treino de hoje após sucesso', async () => {
    // Arrange
    const sessao = makeSessaoResponse();
    mockedIniciar.mockResolvedValue(sessao);
    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useIniciarSessao(), { wrapper: Wrapper });

    // Act
    act(() => {
      result.current.mutate({ treino_id: sessao.treino_id });
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(sessaoKeys.detail(sessao.id))).toEqual(sessao);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: treinoKeys.hoje() });
  });

  it('expõe o estado de erro quando o service falha', async () => {
    // Arrange
    const error = new Error('Falha ao iniciar sessão');
    mockedIniciar.mockRejectedValue(error);
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useIniciarSessao(), { wrapper: Wrapper });

    // Act
    act(() => {
      result.current.mutate({ treino_id: '60000000-0000-0000-0000-000000000001' });
    });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
  });
});
