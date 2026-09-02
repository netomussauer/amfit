import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useConcluirSessao } from './useConcluirSessao';
import { execucaoService } from '../services/execucao.service';
import { sessaoKeys, minhasSessoesKeys } from './query-keys';
import { treinoKeys } from '@/features/treino/hooks/query-keys';
import { makeSessaoResponse } from '../__fixtures__/execucao.fixtures';

jest.mock('../services/execucao.service', () => ({
  execucaoService: {
    concluir: jest.fn(),
  },
}));

const mockedConcluir = execucaoService.concluir as jest.MockedFunction<
  typeof execucaoService.concluir
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

describe('useConcluirSessao', () => {
  beforeEach(() => {
    mockedConcluir.mockReset();
  });

  it('chama o service com o sessaoId informado', async () => {
    // Arrange
    const sessao = makeSessaoResponse({ status: 'CONCLUIDO' });
    mockedConcluir.mockResolvedValue(sessao);
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useConcluirSessao(sessao.id), {
      wrapper: Wrapper,
    });

    // Act
    act(() => {
      result.current.mutate();
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedConcluir).toHaveBeenCalledWith(sessao.id);
  });

  it('atualiza o cache da sessão e invalida treino de hoje e minhas sessões após sucesso', async () => {
    // Arrange
    const sessao = makeSessaoResponse({ status: 'CONCLUIDO' });
    mockedConcluir.mockResolvedValue(sessao);
    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useConcluirSessao(sessao.id), {
      wrapper: Wrapper,
    });

    // Act
    act(() => {
      result.current.mutate();
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(sessaoKeys.detail(sessao.id))).toEqual(sessao);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: treinoKeys.hoje() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: minhasSessoesKeys.all });
  });

  it('expõe o estado de erro quando o service falha', async () => {
    // Arrange
    const error = new Error('Falha ao concluir sessão');
    mockedConcluir.mockRejectedValue(error);
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useConcluirSessao('50000000-0000-0000-0000-000000000001'),
      { wrapper: Wrapper },
    );

    // Act
    act(() => {
      result.current.mutate();
    });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
  });
});
