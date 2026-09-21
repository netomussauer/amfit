import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useLogout } from './useLogout';
import { apiRequest } from '@/shared/lib/api-client';
import { clearAll, getRefreshToken } from '@/shared/lib/auth';
import * as offlineQueue from '@/features/execucao/lib/offlineQueue';
import { limparCache } from '@/shared/lib/query-persist';

jest.mock('@/shared/lib/api-client', () => ({
  apiRequest: jest.fn(),
}));

jest.mock('@/shared/lib/query-persist', () => ({
  limparCache: jest.fn(),
}));

jest.mock('@/shared/lib/auth', () => ({
  clearAll: jest.fn(),
  getRefreshToken: jest.fn(),
}));

jest.mock('@/features/execucao/lib/offlineQueue', () => ({
  clear: jest.fn(),
}));

const mockedReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockedReplace }),
}));

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;
const mockedClearAll = clearAll as jest.MockedFunction<typeof clearAll>;
const mockedGetRefreshToken = getRefreshToken as jest.MockedFunction<
  typeof getRefreshToken
>;
const mockedClearQueue = offlineQueue.clear as jest.MockedFunction<typeof offlineQueue.clear>;
const mockedLimparCache = limparCache as jest.MockedFunction<typeof limparCache>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });

  return { queryClient, Wrapper: function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  } };
}

describe('useLogout', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
    mockedClearAll.mockReset();
    mockedGetRefreshToken.mockReset();
    mockedReplace.mockReset();
    mockedClearQueue.mockReset();
    // O helper real também esvazia o cache em memória — o mock mantém esse
    // efeito, pra os testes continuarem observando o `queryClient.clear()`.
    mockedLimparCache.mockReset();
    mockedLimparCache.mockImplementation(async (queryClient) => {
      queryClient.clear();
    });
  });

  it('chama POST /auth/logout com o refresh_token quando existente', async () => {
    // Arrange
    mockedGetRefreshToken.mockResolvedValue('refresh-token-atual');
    mockedApiRequest.mockResolvedValue(undefined);
    const { Wrapper } = createWrapper();
    const { result } = await renderHook(() => useLogout(), { wrapper: Wrapper });

    // Act
    await act(async () => {
      result.current.mutate();
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiRequest).toHaveBeenCalledWith('/auth/logout', {
      method: 'POST',
      body: { refresh_token: 'refresh-token-atual' },
    });
  });

  it('não chama a API de logout quando não há refresh_token local', async () => {
    // Arrange
    mockedGetRefreshToken.mockResolvedValue(null);
    const { Wrapper } = createWrapper();
    const { result } = await renderHook(() => useLogout(), { wrapper: Wrapper });

    // Act
    await act(async () => {
      result.current.mutate();
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it('limpa a sessão local, o cache do react-query e redireciona para o login mesmo se a chamada à API falhar', async () => {
    // Arrange
    mockedGetRefreshToken.mockResolvedValue('refresh-token-atual');
    mockedApiRequest.mockRejectedValue(new Error('Falha de rede'));
    const { queryClient, Wrapper } = createWrapper();
    const clearSpy = jest.spyOn(queryClient, 'clear');
    const { result } = await renderHook(() => useLogout(), { wrapper: Wrapper });

    // Act
    await act(async () => {
      result.current.mutate();
    });

    // Assert — onSettled roda independentemente do resultado da mutationFn
    await waitFor(() => expect(mockedClearAll).toHaveBeenCalled());
    expect(clearSpy).toHaveBeenCalled();
    expect(mockedReplace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('limpa a fila de sincronização offline ao encerrar a sessão', async () => {
    // Arrange — sem isso, uma ação enfileirada por este usuário poderia
    // ser sincronizada depois na sessão de outro usuário no mesmo aparelho.
    mockedGetRefreshToken.mockResolvedValue('refresh-token-atual');
    mockedApiRequest.mockResolvedValue(undefined);
    const { Wrapper } = createWrapper();
    const { result } = await renderHook(() => useLogout(), { wrapper: Wrapper });

    // Act
    await act(async () => {
      result.current.mutate();
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedClearQueue).toHaveBeenCalled();
  });

  it('apaga o cache (memória + disco) ANTES dos tokens, e só então volta pro login', async () => {
    // Arrange — sem apagar o disco, o próximo login neste aparelho veria
    // treino/ficha do usuário anterior mesmo offline (Fase 6). A ordem
    // importa: se o processo morrer entre os passos, é melhor sobrar um
    // login válido sem cache do que o cache do usuário anterior sem
    // ninguém logado.
    mockedGetRefreshToken.mockResolvedValue('refresh-token-atual');
    mockedApiRequest.mockResolvedValue(undefined);
    const ordem: string[] = [];
    mockedLimparCache.mockImplementation(async (queryClient) => {
      queryClient.clear();
      ordem.push('limpar-cache');
    });
    mockedClearAll.mockImplementation(async () => {
      ordem.push('limpar-tokens');
    });
    mockedReplace.mockImplementation(() => {
      ordem.push('redirect');
    });
    const { queryClient, Wrapper } = createWrapper();
    const clearSpy = jest.spyOn(queryClient, 'clear');
    const { result } = await renderHook(() => useLogout(), { wrapper: Wrapper });

    // Act
    await act(async () => {
      result.current.mutate();
    });

    // Assert — o redirect acontece dentro do onSettled, antes do estado
    // final da mutation ser publicado; esperar o isSuccess evita o teste
    // terminar com uma atualização de estado ainda pendente fora do act().
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedLimparCache).toHaveBeenCalledWith(queryClient);
    expect(clearSpy).toHaveBeenCalled();
    expect(ordem).toEqual(['limpar-cache', 'limpar-tokens', 'redirect']);
    expect(mockedReplace).toHaveBeenCalledWith('/(auth)/login');
  });
});
