import { QueryClient, onlineManager } from '@tanstack/react-query';
import type { RegistroSerieResponse, SessaoResponse } from '@amfit/shared';
import { runDrain } from './offlineSyncEngine';
import { execucaoService } from '../services/execucao.service';
import * as offlineQueue from './offlineQueue';
import type { RegistrarItem, IniciarItem } from './offlineQueue';
import { NetworkError, SyncAuthExpiredError, ApiError } from '@/shared/lib/api-client';
import { sessaoKeys, sessaoIdResolutionKeys, SESSAO_ID_RESOLUTION_FALHOU } from '../hooks/query-keys';
import { treinoKeys } from '@/features/treino/hooks/query-keys';
import { makeSessaoResponse, makeRegistroSerieResponse } from '../__fixtures__/execucao.fixtures';

jest.mock('../services/execucao.service', () => ({
  execucaoService: {
    registrarSerie: jest.fn(),
    iniciar: jest.fn(),
  },
}));

jest.mock('./offlineQueue', () => ({
  getAll: jest.fn(),
  dequeue: jest.fn(),
  updateItem: jest.fn(),
  setNeedsReauth: jest.fn(),
  rewriteSessaoRef: jest.fn(),
}));

const mockedRegistrarSerie = execucaoService.registrarSerie as jest.MockedFunction<
  typeof execucaoService.registrarSerie
>;
const mockedIniciar = execucaoService.iniciar as jest.MockedFunction<
  typeof execucaoService.iniciar
>;
const mockedGetAll = offlineQueue.getAll as jest.MockedFunction<typeof offlineQueue.getAll>;
const mockedDequeue = offlineQueue.dequeue as jest.MockedFunction<typeof offlineQueue.dequeue>;
const mockedUpdateItem = offlineQueue.updateItem as jest.MockedFunction<
  typeof offlineQueue.updateItem
>;
const mockedSetNeedsReauth = offlineQueue.setNeedsReauth as jest.MockedFunction<
  typeof offlineQueue.setNeedsReauth
>;
const mockedRewriteSessaoRef = offlineQueue.rewriteSessaoRef as jest.MockedFunction<
  typeof offlineQueue.rewriteSessaoRef
>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeItem(overrides: Partial<RegistrarItem> = {}): RegistrarItem {
  return {
    id: 'queue-1',
    type: 'registrar_serie',
    sessaoRef: 'sessao-1',
    payload: {
      item_treino_id: '30000000-0000-0000-0000-000000000001',
      numero_serie: 1,
      concluida: true,
      carga_realizada: 60,
      repeticoes_realizadas: 12,
    },
    createdAt: new Date().toISOString(),
    attempts: 0,
    ...overrides,
  };
}

function makeIniciarItem(overrides: Partial<IniciarItem> = {}): IniciarItem {
  return {
    id: 'queue-iniciar-1',
    type: 'iniciar_sessao',
    localSessaoId: 'local-1-abc',
    payload: { treino_id: '60000000-0000-0000-0000-000000000001' },
    createdAt: new Date().toISOString(),
    attempts: 0,
    ...overrides,
  };
}

describe('offlineSyncEngine.runDrain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    onlineManager.setOnline(true);
  });

  it('não faz nada quando está offline', async () => {
    onlineManager.setOnline(false);
    const queryClient = new QueryClient();

    await runDrain(queryClient);

    expect(mockedGetAll).not.toHaveBeenCalled();
  });

  it('drena a fila em ordem FIFO, atualizando o cache e removendo cada item processado', async () => {
    const sessao = makeSessaoResponse({ id: 'sessao-1', series: [] });
    const queryClient = new QueryClient();
    queryClient.setQueryData(sessaoKeys.detail('sessao-1'), sessao);

    const item1 = makeItem({ id: 'queue-1' });
    const item2 = makeItem({ id: 'queue-2', payload: { ...item1.payload, numero_serie: 2 } });
    mockedGetAll
      .mockResolvedValueOnce([item1, item2])
      .mockResolvedValueOnce([item2])
      .mockResolvedValueOnce([]);
    const registro1 = makeRegistroSerieResponse({ numero_serie: 1 });
    const registro2 = makeRegistroSerieResponse({ numero_serie: 2 });
    mockedRegistrarSerie.mockResolvedValueOnce(registro1).mockResolvedValueOnce(registro2);

    await runDrain(queryClient);

    expect(mockedRegistrarSerie).toHaveBeenNthCalledWith(1, 'sessao-1', item1.payload, {
      isBackgroundSync: true,
    });
    expect(mockedRegistrarSerie).toHaveBeenNthCalledWith(2, 'sessao-1', item2.payload, {
      isBackgroundSync: true,
    });
    expect(mockedDequeue).toHaveBeenNthCalledWith(1, 'queue-1');
    expect(mockedDequeue).toHaveBeenNthCalledWith(2, 'queue-2');
    const cacheFinal = queryClient.getQueryData<ReturnType<typeof makeSessaoResponse>>(
      sessaoKeys.detail('sessao-1'),
    );
    expect(cacheFinal?.series).toEqual([registro1, registro2]);
  });

  it('drena um iniciar_sessao: cria a sessão real, funde séries locais, reescreve sessaoRef, resolve navegação e invalida treino de hoje', async () => {
    const cacheLocal = makeSessaoResponse({
      id: 'local-1-abc',
      series: [makeRegistroSerieResponse({ numero_serie: 1 })],
    });
    const sessaoReal = makeSessaoResponse({
      id: '50000000-0000-0000-0000-000000000099',
      series: [],
    });
    const queryClient = new QueryClient();
    queryClient.setQueryData(sessaoKeys.detail('local-1-abc'), cacheLocal);
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const item = makeIniciarItem();
    mockedGetAll.mockResolvedValueOnce([item]).mockResolvedValueOnce([]);
    mockedIniciar.mockResolvedValueOnce(sessaoReal);

    await runDrain(queryClient);

    expect(mockedIniciar).toHaveBeenCalledWith(item.payload.treino_id, {
      isBackgroundSync: true,
    });
    const cacheFinal = queryClient.getQueryData<SessaoResponse>(
      sessaoKeys.detail(sessaoReal.id),
    );
    expect(cacheFinal?.series).toEqual(cacheLocal.series);
    expect(mockedRewriteSessaoRef).toHaveBeenCalledWith('local-1-abc', sessaoReal.id);
    expect(queryClient.getQueryData(sessaoIdResolutionKeys.detail('local-1-abc'))).toBe(
      sessaoReal.id,
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: treinoKeys.hoje() });
    expect(mockedDequeue).toHaveBeenCalledWith(item.id);
  });

  it('funde séries locais com séries já existentes na sessão real (replay idempotente do iniciar)', async () => {
    // Arrange — `iniciar` é idempotente: pode devolver uma sessão que já
    // tinha séries reais (de outro dispositivo, por exemplo), além das
    // que foram registradas localmente enquanto offline neste aparelho.
    const serieLocal = makeRegistroSerieResponse({ numero_serie: 1, id: 'local-serie' });
    const serieReal = makeRegistroSerieResponse({ numero_serie: 2, id: 'serie-de-outro-device' });
    const cacheLocal = makeSessaoResponse({ id: 'local-1-abc', series: [serieLocal] });
    const sessaoReal = makeSessaoResponse({
      id: '50000000-0000-0000-0000-000000000099',
      series: [serieReal],
    });
    const queryClient = new QueryClient();
    queryClient.setQueryData(sessaoKeys.detail('local-1-abc'), cacheLocal);

    const item = makeIniciarItem();
    mockedGetAll.mockResolvedValueOnce([item]).mockResolvedValueOnce([]);
    mockedIniciar.mockResolvedValueOnce(sessaoReal);

    await runDrain(queryClient);

    const cacheFinal = queryClient.getQueryData<SessaoResponse>(
      sessaoKeys.detail(sessaoReal.id),
    );
    expect(cacheFinal?.series).toEqual(expect.arrayContaining([serieReal, serieLocal]));
    expect(cacheFinal?.series).toHaveLength(2);
  });

  it('grava o marcador de falha na resolução quando iniciar_sessao é descartado em definitivo', async () => {
    // Sem isso, uma tela ainda montada em `/treino/local-1-abc` ficaria
    // presa pra sempre em "Aguardando sincronizar...", já que o item
    // nunca mais seria tentado de novo depois de descartado.
    const queryClient = new QueryClient();
    const item = makeIniciarItem();
    mockedGetAll.mockResolvedValueOnce([item]).mockResolvedValueOnce([]);
    mockedIniciar.mockRejectedValue(new ApiError(404, 'treino não encontrado'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await runDrain(queryClient);

    expect(
      queryClient.getQueryData(sessaoIdResolutionKeys.detail('local-1-abc')),
    ).toBe(SESSAO_ID_RESOLUTION_FALHOU);
    expect(mockedDequeue).toHaveBeenCalledWith(item.id);
    warnSpy.mockRestore();
  });

  it('para (sem desenfileirar) quando iniciar_sessao falha com NetworkError', async () => {
    const queryClient = new QueryClient();
    const item = makeIniciarItem();
    mockedGetAll.mockResolvedValueOnce([item]);
    mockedIniciar.mockRejectedValue(new NetworkError());

    await runDrain(queryClient);

    expect(mockedDequeue).not.toHaveBeenCalled();
    expect(mockedRewriteSessaoRef).not.toHaveBeenCalled();
  });

  it('para o drain (sem desenfileirar nada) quando o item da vez é concluir_sessao (ainda não implementado)', async () => {
    const queryClient = new QueryClient();
    mockedGetAll.mockResolvedValueOnce([
      {
        id: 'queue-concluir-1',
        type: 'concluir_sessao' as const,
        sessaoRef: 'sessao-1',
        createdAt: new Date().toISOString(),
        attempts: 0,
      },
    ]);

    await runDrain(queryClient);

    expect(mockedDequeue).not.toHaveBeenCalled();
    expect(mockedIniciar).not.toHaveBeenCalled();
    expect(mockedRegistrarSerie).not.toHaveBeenCalled();
  });

  it('para (sem desenfileirar) quando um item falha com NetworkError', async () => {
    const queryClient = new QueryClient();
    const item = makeItem();
    mockedGetAll.mockResolvedValueOnce([item]);
    mockedRegistrarSerie.mockRejectedValue(new NetworkError());

    await runDrain(queryClient);

    expect(mockedDequeue).not.toHaveBeenCalled();
    expect(mockedUpdateItem).not.toHaveBeenCalled();
  });

  it('marca needsReauth (sem desenfileirar) quando expira durante sync em segundo plano', async () => {
    const queryClient = new QueryClient();
    const item = makeItem();
    mockedGetAll.mockResolvedValueOnce([item]);
    mockedRegistrarSerie.mockRejectedValue(new SyncAuthExpiredError());

    await runDrain(queryClient);

    expect(mockedSetNeedsReauth).toHaveBeenCalledWith(true);
    expect(mockedDequeue).not.toHaveBeenCalled();
  });

  it('descarta o item quando o backend recusa em definitivo, sem travar o resto da fila', async () => {
    const queryClient = new QueryClient();
    const item = makeItem();
    mockedGetAll.mockResolvedValueOnce([item]).mockResolvedValueOnce([]);
    mockedRegistrarSerie.mockRejectedValue(new ApiError(422, 'carga inválida'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await runDrain(queryClient);

    expect(mockedDequeue).toHaveBeenCalledWith('queue-1');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('não drena duas vezes concorrentemente', async () => {
    const queryClient = new QueryClient();
    const item = makeItem();
    // Só o primeiro getAll() devolve o item "em voo" — depois que ele é
    // processado e desenfileirado (mock), a fila já está vazia; sem isso
    // (um mockResolvedValue persistente) o drain reprocessaria o mesmo
    // item indefinidamente, já que dequeue é só um mock sem efeito real
    // sobre o que getAll devolve.
    mockedGetAll.mockResolvedValueOnce([item]).mockResolvedValue([]);
    const { promise, resolve } = deferred<RegistroSerieResponse>();
    mockedRegistrarSerie.mockReturnValueOnce(promise);

    const first = runDrain(queryClient);
    await runDrain(queryClient);

    expect(mockedRegistrarSerie).toHaveBeenCalledTimes(1);

    resolve(makeRegistroSerieResponse());
    await first;
  });
});
