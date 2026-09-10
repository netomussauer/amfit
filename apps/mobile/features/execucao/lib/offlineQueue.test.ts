import AsyncStorage from '@react-native-async-storage/async-storage';
import * as offlineQueue from './offlineQueue';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
const mockedSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;

const registrarPayload = {
  item_treino_id: '30000000-0000-0000-0000-000000000001',
  numero_serie: 1,
  concluida: true,
  carga_realizada: 60,
  repeticoes_realizadas: 12,
};

/** Fake em memória do AsyncStorage — mais confiável do que encadear
 * manualmente o último `setItem` no próximo `getItem` a cada chamada. */
let storedRaw: string | null = null;

describe('offlineQueue', () => {
  beforeEach(async () => {
    storedRaw = null;
    mockedGetItem.mockImplementation(async () => storedRaw);
    mockedSetItem.mockImplementation(async (_key: string, value: string) => {
      storedRaw = value;
    });
    // Sincroniza o cachedCount interno do módulo com o storage zerado
    // deste teste (o módulo mantém seu próprio snapshot em memória pra
    // atender useSyncExternalStore).
    await offlineQueue.clear();
  });

  it('mantém ordem FIFO entre enfileiramentos', async () => {
    const primeiro = await offlineQueue.enqueue({
      type: 'registrar_serie',
      sessaoRef: 'sessao-1',
      payload: registrarPayload,
    });
    const segundo = await offlineQueue.enqueue({
      type: 'registrar_serie',
      sessaoRef: 'sessao-1',
      payload: { ...registrarPayload, numero_serie: 2 },
    });

    const todos = await offlineQueue.getAll();

    expect(todos.map((item) => item.id)).toEqual([primeiro.id, segundo.id]);
  });

  it('devolve fila vazia quando o storage está corrompido', async () => {
    storedRaw = '{ isso não é json válido';

    const todos = await offlineQueue.getAll();

    expect(todos).toEqual([]);
  });

  it('devolve fila vazia quando o storage não tem o formato esperado', async () => {
    storedRaw = JSON.stringify({ nada: 'a ver' });

    const todos = await offlineQueue.getAll();

    expect(todos).toEqual([]);
  });

  it('dequeue remove só o item pedido', async () => {
    const item1 = await offlineQueue.enqueue({
      type: 'registrar_serie',
      sessaoRef: 'sessao-1',
      payload: registrarPayload,
    });
    const item2 = await offlineQueue.enqueue({
      type: 'registrar_serie',
      sessaoRef: 'sessao-1',
      payload: { ...registrarPayload, numero_serie: 2 },
    });

    await offlineQueue.dequeue(item1.id);

    const restantes = await offlineQueue.getAll();
    expect(restantes.map((item) => item.id)).toEqual([item2.id]);
  });

  it('updateItem faz merge parcial mantendo os outros campos', async () => {
    const item = await offlineQueue.enqueue({
      type: 'registrar_serie',
      sessaoRef: 'sessao-1',
      payload: registrarPayload,
    });

    await offlineQueue.updateItem(item.id, { attempts: 1, lastError: 'falhou' });

    const [atualizado] = await offlineQueue.getAll();
    expect(atualizado).toMatchObject({
      id: item.id,
      attempts: 1,
      lastError: 'falhou',
      type: 'registrar_serie',
    });
  });

  it('getPendingCount reflete o total de itens na fila', async () => {
    expect(await offlineQueue.getPendingCount()).toBe(0);

    await offlineQueue.enqueue({
      type: 'registrar_serie',
      sessaoRef: 'sessao-1',
      payload: registrarPayload,
    });

    expect(await offlineQueue.getPendingCount()).toBe(1);
  });

  it('setNeedsReauth/getNeedsReauth persistem a flag', async () => {
    expect(await offlineQueue.getNeedsReauth()).toBe(false);

    await offlineQueue.setNeedsReauth(true);

    expect(await offlineQueue.getNeedsReauth()).toBe(true);
  });

  it('notifica os inscritos e atualiza o snapshot síncrono a cada mudança', async () => {
    const listener = jest.fn();
    const unsubscribe = offlineQueue.subscribe(listener);

    await offlineQueue.enqueue({
      type: 'registrar_serie',
      sessaoRef: 'sessao-1',
      payload: registrarPayload,
    });

    expect(listener).toHaveBeenCalled();
    expect(offlineQueue.getSnapshotCount()).toBe(1);

    unsubscribe();
  });
});
