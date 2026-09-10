import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import type { RegistroSerieResponse, SessaoResponse } from '@amfit/shared';
import { useRegistrarSerie } from './useRegistrarSerie';
import { execucaoService } from '../services/execucao.service';
import { sessaoKeys } from './query-keys';
import { NetworkError } from '@/shared/lib/api-client';
import * as offlineQueue from '../lib/offlineQueue';
import { runDrain } from '../lib/offlineSyncEngine';
import {
  makeRegistroSerieResponse,
  makeSessaoResponse,
} from '../__fixtures__/execucao.fixtures';

jest.mock('../services/execucao.service', () => ({
  execucaoService: {
    registrarSerie: jest.fn(),
  },
}));

jest.mock('../lib/offlineQueue', () => ({
  enqueue: jest.fn(),
}));

jest.mock('../lib/offlineSyncEngine', () => ({
  runDrain: jest.fn(),
}));

const mockedRegistrarSerie = execucaoService.registrarSerie as jest.MockedFunction<
  typeof execucaoService.registrarSerie
>;
const mockedEnqueue = offlineQueue.enqueue as jest.MockedFunction<typeof offlineQueue.enqueue>;
const mockedRunDrain = runDrain as jest.MockedFunction<typeof runDrain>;

function createWrapper(sessaoInicial?: SessaoResponse) {
  const queryClient = new QueryClient({
    defaultOptions: {
      // gcTime padrão (não 0): o cache é lido diretamente via
      // `getQueryData` sem nenhum `useSessao` observando a query — com
      // gcTime 0 a entrada seria coletada antes da asserção rodar.
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  if (sessaoInicial) {
    queryClient.setQueryData(sessaoKeys.detail(sessaoInicial.id), sessaoInicial);
  }

  const Wrapper = function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  return { queryClient, Wrapper };
}

/** Cria uma Promise controlável externamente para simular uma mutation "em voo". */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useRegistrarSerie', () => {
  beforeEach(() => {
    mockedRegistrarSerie.mockReset();
    mockedEnqueue.mockReset();
    mockedRunDrain.mockReset();
    onlineManager.setOnline(true);
  });

  it('chama o service com o sessaoId e o corpo informados', async () => {
    // Arrange
    const sessao = makeSessaoResponse({ series: [] });
    const registro = makeRegistroSerieResponse({ concluida: true });
    mockedRegistrarSerie.mockResolvedValue(registro);
    const { Wrapper } = createWrapper(sessao);
    const { result } = await renderHook(() => useRegistrarSerie(sessao.id), {
      wrapper: Wrapper,
    });

    // Act
    await act(async () => {
      result.current.mutate({
        item_treino_id: registro.item_treino_id,
        numero_serie: registro.numero_serie,
        concluida: true,
        carga_realizada: 80,
        repeticoes_realizadas: 10,
      });
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedRegistrarSerie).toHaveBeenCalledWith(sessao.id, {
      item_treino_id: registro.item_treino_id,
      numero_serie: registro.numero_serie,
      concluida: true,
      carga_realizada: 80,
      repeticoes_realizadas: 10,
    });
  });

  it('aplica um optimistic update no cache antes da resposta do backend', async () => {
    // Arrange — sessão sem nenhuma série registrada ainda
    const sessao = makeSessaoResponse({ series: [] });
    const { promise, resolve } = deferred<RegistroSerieResponse>();
    mockedRegistrarSerie.mockReturnValue(promise);
    const { queryClient, Wrapper } = createWrapper(sessao);
    const { result } = await renderHook(() => useRegistrarSerie(sessao.id), {
      wrapper: Wrapper,
    });

    // Act
    await act(async () => {
      result.current.mutate({
        item_treino_id: '30000000-0000-0000-0000-000000000001',
        numero_serie: 1,
        concluida: true,
        carga_realizada: 60,
        repeticoes_realizadas: 12,
      });
    });

    // Assert — antes da resposta do backend, o cache já reflete a série otimista
    await waitFor(() => expect(result.current.isPending).toBe(true));
    const cacheOtimista = queryClient.getQueryData<SessaoResponse>(
      sessaoKeys.detail(sessao.id),
    );
    expect(cacheOtimista?.series).toHaveLength(1);
    expect(cacheOtimista?.series[0]).toMatchObject({
      item_treino_id: '30000000-0000-0000-0000-000000000001',
      numero_serie: 1,
      concluida: true,
      carga_realizada: 60,
      repeticoes_realizadas: 12,
    });

    // Cleanup — resolve a promise pendente para não vazar entre testes
    resolve(makeRegistroSerieResponse());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('substitui o registro otimista pelo retornado pelo backend após sucesso', async () => {
    // Arrange
    const sessao = makeSessaoResponse({ series: [] });
    const registro = makeRegistroSerieResponse({
      id: 'registro-real-id',
      item_treino_id: '30000000-0000-0000-0000-000000000001',
      numero_serie: 1,
      concluida: true,
      carga_realizada: 60,
      repeticoes_realizadas: 12,
    });
    mockedRegistrarSerie.mockResolvedValue(registro);
    const { queryClient, Wrapper } = createWrapper(sessao);
    const { result } = await renderHook(() => useRegistrarSerie(sessao.id), {
      wrapper: Wrapper,
    });

    // Act
    await act(async () => {
      result.current.mutate({
        item_treino_id: registro.item_treino_id,
        numero_serie: registro.numero_serie,
        concluida: true,
        carga_realizada: 60,
        repeticoes_realizadas: 12,
      });
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cacheFinal = queryClient.getQueryData<SessaoResponse>(
      sessaoKeys.detail(sessao.id),
    );
    expect(cacheFinal?.series).toEqual([registro]);
  });

  it('reverte o cache para o estado anterior quando o service falha', async () => {
    // Arrange
    const registroExistente = makeRegistroSerieResponse({ concluida: false });
    const sessao = makeSessaoResponse({ series: [registroExistente] });
    const error = new Error('Falha ao registrar série');
    mockedRegistrarSerie.mockRejectedValue(error);
    const { queryClient, Wrapper } = createWrapper(sessao);
    const { result } = await renderHook(() => useRegistrarSerie(sessao.id), {
      wrapper: Wrapper,
    });

    // Act
    await act(async () => {
      result.current.mutate({
        item_treino_id: registroExistente.item_treino_id,
        numero_serie: registroExistente.numero_serie,
        concluida: true,
        carga_realizada: 82.5,
        repeticoes_realizadas: 8,
      });
    });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
    const cacheRevertido = queryClient.getQueryData<SessaoResponse>(
      sessaoKeys.detail(sessao.id),
    );
    expect(cacheRevertido).toEqual(sessao);
  });

  it('enfileira e resolve como sucesso quando o service falha com NetworkError', async () => {
    // Arrange — conexão caiu no meio da chamada (fetch rejeita), não um
    // erro de negócio: não deve disparar onError/rollback.
    const sessao = makeSessaoResponse({ series: [] });
    mockedRegistrarSerie.mockRejectedValue(new NetworkError());
    mockedEnqueue.mockResolvedValue({
      id: 'queue-1',
      type: 'registrar_serie',
      sessaoRef: sessao.id,
      payload: {
        item_treino_id: '30000000-0000-0000-0000-000000000001',
        numero_serie: 1,
        concluida: true,
        carga_realizada: 60,
        repeticoes_realizadas: 12,
      },
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
    const { queryClient, Wrapper } = createWrapper(sessao);
    const { result } = await renderHook(() => useRegistrarSerie(sessao.id), {
      wrapper: Wrapper,
    });

    // Act
    await act(async () => {
      result.current.mutate({
        item_treino_id: '30000000-0000-0000-0000-000000000001',
        numero_serie: 1,
        concluida: true,
        carga_realizada: 60,
        repeticoes_realizadas: 12,
      });
    });

    // Assert — sucesso otimista, sem rollback, e o item foi enfileirado
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedEnqueue).toHaveBeenCalledWith({
      type: 'registrar_serie',
      sessaoRef: sessao.id,
      payload: {
        item_treino_id: '30000000-0000-0000-0000-000000000001',
        numero_serie: 1,
        concluida: true,
        carga_realizada: 60,
        repeticoes_realizadas: 12,
      },
    });
    expect(mockedRunDrain).toHaveBeenCalled();
    const cacheFinal = queryClient.getQueryData<SessaoResponse>(
      sessaoKeys.detail(sessao.id),
    );
    expect(cacheFinal?.series).toHaveLength(1);
    expect(cacheFinal?.series[0].id).toBe('queued-queue-1');
  });

  it('enfileira direto (sem tentar o service) quando já está offline', async () => {
    // Arrange
    onlineManager.setOnline(false);
    const sessao = makeSessaoResponse({ series: [] });
    mockedEnqueue.mockResolvedValue({
      id: 'queue-2',
      type: 'registrar_serie',
      sessaoRef: sessao.id,
      payload: {
        item_treino_id: '30000000-0000-0000-0000-000000000001',
        numero_serie: 1,
        concluida: true,
        carga_realizada: null,
        repeticoes_realizadas: null,
      },
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
    const { Wrapper } = createWrapper(sessao);
    const { result } = await renderHook(() => useRegistrarSerie(sessao.id), {
      wrapper: Wrapper,
    });

    // Act
    await act(async () => {
      result.current.mutate({
        item_treino_id: '30000000-0000-0000-0000-000000000001',
        numero_serie: 1,
        concluida: true,
      });
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedRegistrarSerie).not.toHaveBeenCalled();
    expect(mockedEnqueue).toHaveBeenCalledTimes(1);
  });
});
