import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useIniciarSessao } from './useIniciarSessao';
import { execucaoService } from '../services/execucao.service';
import { sessaoKeys } from './query-keys';
import { treinoKeys } from '@/features/treino/hooks/query-keys';
import { NetworkError } from '@/shared/lib/api-client';
import * as offlineQueue from '../lib/offlineQueue';
import { runDrain } from '../lib/offlineSyncEngine';
import { isLocalSessaoId } from '../lib/localSessaoId';
import { makeSessaoResponse } from '../__fixtures__/execucao.fixtures';

jest.mock('../services/execucao.service', () => ({
  execucaoService: {
    iniciar: jest.fn(),
  },
}));

jest.mock('../lib/offlineQueue', () => ({
  enqueue: jest.fn(),
}));

jest.mock('../lib/offlineSyncEngine', () => ({
  runDrain: jest.fn(),
}));

const mockedIniciar = execucaoService.iniciar as jest.MockedFunction<
  typeof execucaoService.iniciar
>;
const mockedEnqueue = offlineQueue.enqueue as jest.MockedFunction<typeof offlineQueue.enqueue>;
const mockedRunDrain = runDrain as jest.MockedFunction<typeof runDrain>;

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
    mockedEnqueue.mockReset();
    mockedRunDrain.mockReset();
    onlineManager.setOnline(true);
  });

  it('chama o service com o treino_id informado', async () => {
    // Arrange
    const sessao = makeSessaoResponse();
    mockedIniciar.mockResolvedValue(sessao);
    const { Wrapper } = createWrapper();
    const { result } = await renderHook(() => useIniciarSessao(), { wrapper: Wrapper });

    // Act
    await act(async () => {
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
    const { result } = await renderHook(() => useIniciarSessao(), { wrapper: Wrapper });

    // Act
    await act(async () => {
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
    const { result } = await renderHook(() => useIniciarSessao(), { wrapper: Wrapper });

    // Act
    await act(async () => {
      result.current.mutate({ treino_id: '60000000-0000-0000-0000-000000000001' });
    });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
  });

  it('enfileira e resolve com um placeholder de ID local quando offline', async () => {
    // Arrange
    onlineManager.setOnline(false);
    mockedEnqueue.mockResolvedValue({
      id: 'queue-1',
      type: 'iniciar_sessao',
      localSessaoId: 'local-1-abc',
      payload: { treino_id: '60000000-0000-0000-0000-000000000001' },
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
    const { Wrapper } = createWrapper();
    const { result } = await renderHook(() => useIniciarSessao(), { wrapper: Wrapper });

    // Act
    await act(async () => {
      result.current.mutate({ treino_id: '60000000-0000-0000-0000-000000000001' });
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedIniciar).not.toHaveBeenCalled();
    expect(mockedEnqueue).toHaveBeenCalledWith({
      type: 'iniciar_sessao',
      localSessaoId: expect.any(String),
      payload: { treino_id: '60000000-0000-0000-0000-000000000001' },
    });
    expect(mockedRunDrain).toHaveBeenCalled();
    expect(result.current.data && isLocalSessaoId(result.current.data.id)).toBe(true);
  });

  it('enfileira e resolve como sucesso quando o service falha com NetworkError', async () => {
    // Arrange — conexão caiu no meio da chamada, não um erro de negócio.
    mockedIniciar.mockRejectedValue(new NetworkError());
    mockedEnqueue.mockResolvedValue({
      id: 'queue-1',
      type: 'iniciar_sessao',
      localSessaoId: 'local-1-abc',
      payload: { treino_id: '60000000-0000-0000-0000-000000000001' },
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
    const { Wrapper } = createWrapper();
    const { result } = await renderHook(() => useIniciarSessao(), { wrapper: Wrapper });

    // Act
    await act(async () => {
      result.current.mutate({ treino_id: '60000000-0000-0000-0000-000000000001' });
    });

    // Assert — sucesso, não cai no isError
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedEnqueue).toHaveBeenCalledTimes(1);
  });
});
