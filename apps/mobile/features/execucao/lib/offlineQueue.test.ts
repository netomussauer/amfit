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

  it('rewriteSessaoRef troca sessaoRef só nos itens que apontavam pro ID antigo', async () => {
    const alvo = await offlineQueue.enqueue({
      type: 'registrar_serie',
      sessaoRef: 'local-1-abc',
      payload: registrarPayload,
    });
    const outroSessao = await offlineQueue.enqueue({
      type: 'registrar_serie',
      sessaoRef: 'sessao-nao-relacionada',
      payload: { ...registrarPayload, numero_serie: 2 },
    });

    await offlineQueue.rewriteSessaoRef('local-1-abc', '50000000-0000-0000-0000-000000000099');

    const todos = await offlineQueue.getAll();
    const atualizado = todos.find((item) => item.id === alvo.id);
    const inalterado = todos.find((item) => item.id === outroSessao.id);
    expect(atualizado).toMatchObject({ sessaoRef: '50000000-0000-0000-0000-000000000099' });
    expect(inalterado).toMatchObject({ sessaoRef: 'sessao-nao-relacionada' });
  });

  it('rewriteSessaoRef não mexe em itens iniciar_sessao (não têm sessaoRef)', async () => {
    const iniciarItem = await offlineQueue.enqueue({
      type: 'iniciar_sessao',
      localSessaoId: 'local-1-abc',
      payload: { treino_id: '60000000-0000-0000-0000-000000000001' },
    });

    await offlineQueue.rewriteSessaoRef('local-1-abc', '50000000-0000-0000-0000-000000000099');

    const [item] = await offlineQueue.getAll();
    expect(item).toEqual(iniciarItem);
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

  it('serializa operações concorrentes de leitura-modificação-escrita, sem perder nenhuma', async () => {
    // Sem serialização, três `enqueue` disparados ao mesmo tempo leriam o
    // envelope quase simultaneamente (get, get, get) antes de qualquer
    // escrita — cada `setItem` sobrescreveria o anterior, e só o último
    // item sobreviveria. Rastreamos a ordem das chamadas pra confirmar
    // que elas alternam get→set→get→set (nunca get→get antes de um set).
    const callOrder: string[] = [];
    mockedGetItem.mockImplementation(async () => {
      callOrder.push('get');
      return storedRaw;
    });
    mockedSetItem.mockImplementation(async (_key: string, value: string) => {
      callOrder.push('set');
      storedRaw = value;
    });

    await Promise.all([
      offlineQueue.enqueue({
        type: 'registrar_serie',
        sessaoRef: 'sessao-a',
        payload: registrarPayload,
      }),
      offlineQueue.enqueue({
        type: 'registrar_serie',
        sessaoRef: 'sessao-b',
        payload: registrarPayload,
      }),
      offlineQueue.enqueue({
        type: 'registrar_serie',
        sessaoRef: 'sessao-c',
        payload: registrarPayload,
      }),
    ]);

    expect(callOrder).toEqual(['get', 'set', 'get', 'set', 'get', 'set']);
    const todos = await offlineQueue.getAll();
    expect(todos).toHaveLength(3);
  });
});
