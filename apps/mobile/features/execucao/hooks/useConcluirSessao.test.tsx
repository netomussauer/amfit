import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useConcluirSessao } from './useConcluirSessao';
import { execucaoService } from '../services/execucao.service';
import { sessaoKeys, minhasSessoesKeys } from './query-keys';
import { treinoKeys } from '@/features/treino/hooks/query-keys';
import { NetworkError } from '@/shared/lib/api-client';
import * as offlineQueue from '../lib/offlineQueue';
import { runDrain } from '../lib/offlineSyncEngine';
import { makeSessaoResponse } from '../__fixtures__/execucao.fixtures';

jest.mock('../services/execucao.service', () => ({
  execucaoService: {
    concluir: jest.fn(),
  },
}));

jest.mock('../lib/offlineQueue', () => ({
  enqueue: jest.fn(),
}));

jest.mock('../lib/offlineSyncEngine', () => ({
  runDrain: jest.fn(),
}));

const mockedConcluir = execucaoService.concluir as jest.MockedFunction<
  typeof execucaoService.concluir
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

describe('useConcluirSessao', () => {
  beforeEach(() => {
    mockedConcluir.mockReset();
    mockedEnqueue.mockReset();
    mockedRunDrain.mockReset();
    onlineManager.setOnline(true);
  });

  it('chama o service com o sessaoId informado', async () => {
    // Arrange
    const sessao = makeSessaoResponse({ status: 'CONCLUIDO' });
    mockedConcluir.mockResolvedValue(sessao);
    const { Wrapper } = createWrapper();
    const { result } = await renderHook(() => useConcluirSessao(sessao.id), {
      wrapper: Wrapper,
    });

    // Act
    await act(async () => {
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
    const { result } = await renderHook(() => useConcluirSessao(sessao.id), {
      wrapper: Wrapper,
    });

    // Act
    await act(async () => {
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
    const { result } = await renderHook(
      () => useConcluirSessao('50000000-0000-0000-0000-000000000001'),
      { wrapper: Wrapper },
    );

    // Act
    await act(async () => {
      result.current.mutate();
    });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
  });

  it('enfileira e resolve com uma sessão otimista CONCLUIDO quando offline', async () => {
    // Arrange
    onlineManager.setOnline(false);
    const sessao = makeSessaoResponse({ series: [] });
    const { queryClient, Wrapper } = createWrapper();
    queryClient.setQueryData(sessaoKeys.detail(sessao.id), sessao);
    mockedEnqueue.mockResolvedValue({
      id: 'queue-1',
      type: 'concluir_sessao',
      sessaoRef: sessao.id,
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
    const { result } = await renderHook(() => useConcluirSessao(sessao.id), {
      wrapper: Wrapper,
    });

    // Act
    await act(async () => {
      result.current.mutate();
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedConcluir).not.toHaveBeenCalled();
    expect(mockedEnqueue).toHaveBeenCalledWith({
      type: 'concluir_sessao',
      sessaoRef: sessao.id,
    });
    expect(mockedRunDrain).toHaveBeenCalled();
    expect(result.current.data).toMatchObject({ status: 'CONCLUIDO' });
    expect(result.current.data?.concluido_em).toEqual(expect.any(String));
    const cacheFinal = queryClient.getQueryData<ReturnType<typeof makeSessaoResponse>>(
      sessaoKeys.detail(sessao.id),
    );
    expect(cacheFinal?.status).toBe('CONCLUIDO');
  });

  it('enfileira direto (sem tentar o service) mesmo online, quando a sessão ainda tem ID local não sincronizado', async () => {
    // Arrange — um ID local nunca existe no servidor, mesmo estando
    // online agora: a sessão em si (iniciada offline) ainda não
    // sincronizou. Tentar a chamada real daria um 404 genérico contra
    // /sessoes/local-xxx/concluir em vez de enfileirar.
    onlineManager.setOnline(true);
    const sessaoLocal = makeSessaoResponse({ id: 'local-1234567890-abc123', series: [] });
    const { queryClient, Wrapper } = createWrapper();
    queryClient.setQueryData(sessaoKeys.detail(sessaoLocal.id), sessaoLocal);
    mockedEnqueue.mockResolvedValue({
      id: 'queue-1',
      type: 'concluir_sessao',
      sessaoRef: sessaoLocal.id,
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
    const { result } = await renderHook(() => useConcluirSessao(sessaoLocal.id), {
      wrapper: Wrapper,
    });

    // Act
    await act(async () => {
      result.current.mutate();
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedConcluir).not.toHaveBeenCalled();
    expect(mockedEnqueue).toHaveBeenCalledWith({
      type: 'concluir_sessao',
      sessaoRef: sessaoLocal.id,
    });
  });

  it('enfileira e resolve como sucesso quando o service falha com NetworkError', async () => {
    // Arrange — conexão caiu no meio da chamada, não um erro de negócio.
    const sessao = makeSessaoResponse({ series: [] });
    mockedConcluir.mockRejectedValue(new NetworkError());
    mockedEnqueue.mockResolvedValue({
      id: 'queue-1',
      type: 'concluir_sessao',
      sessaoRef: sessao.id,
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
    const { queryClient, Wrapper } = createWrapper();
    queryClient.setQueryData(sessaoKeys.detail(sessao.id), sessao);
    const { result } = await renderHook(() => useConcluirSessao(sessao.id), {
      wrapper: Wrapper,
    });

    // Act
    await act(async () => {
      result.current.mutate();
    });

    // Assert — sucesso, não cai no isError
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedEnqueue).toHaveBeenCalledTimes(1);
  });
});
