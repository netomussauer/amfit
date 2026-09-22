import AsyncStorage from '@react-native-async-storage/async-storage';
import * as offlineQueue from './offlineQueue';
import { getCurrentUser } from '@/shared/lib/auth';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

jest.mock('@/shared/lib/auth', () => ({
  getCurrentUser: jest.fn(),
}));

const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
const mockedSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;
const mockedGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;

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
    // Um usuário único por padrão — os testes que não são sobre posse da
    // fila não precisam se preocupar com isso.
    mockedGetCurrentUser.mockResolvedValue({ sub: 'user-a' });
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

  it('getSnapshotNeedsReauth reflete setNeedsReauth e notifica os inscritos', async () => {
    expect(offlineQueue.getSnapshotNeedsReauth()).toBe(false);
    const listener = jest.fn();
    const unsubscribe = offlineQueue.subscribe(listener);

    await offlineQueue.setNeedsReauth(true);

    expect(offlineQueue.getSnapshotNeedsReauth()).toBe(true);
    expect(listener).toHaveBeenCalled();

    await offlineQueue.setNeedsReauth(false);

    expect(offlineQueue.getSnapshotNeedsReauth()).toBe(false);
    unsubscribe();
  });

  it('serializa operações concorrentes de leitura-modificação-escrita, sem perder nenhuma', async () => {
    // Sem serialização, três `enqueue` disparados ao mesmo tempo leriam o
    // envelope quase simultaneamente antes de qualquer escrita — cada
    // `setItem` sobrescreveria o anterior, e só o último item
    // sobreviveria (ou, pior, um item de outro sobrescrevendo o de um
    // terceiro por baixo). A verificação de dono acontece dentro da MESMA
    // transação travada da escrita do item (não uma transação à parte),
    // então cada `enqueue` continua sendo exatamente um ciclo
    // leitura-escrita — a contagem de itens em cada escrita nunca regride
    // e termina em 3, com os três `sessaoRef` distintos presentes.
    const contagensNasEscritas: number[] = [];
    mockedSetItem.mockImplementation(async (_key: string, value: string) => {
      contagensNasEscritas.push((JSON.parse(value) as { items: unknown[] }).items.length);
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

    expect(contagensNasEscritas).toEqual([1, 2, 3]);
    const todos = await offlineQueue.getAll();
    expect(todos).toHaveLength(3);
    expect(todos.map((item) => (item as { sessaoRef: string }).sessaoRef).sort()).toEqual([
      'sessao-a',
      'sessao-b',
      'sessao-c',
    ]);
  });

  describe('posse da fila (garantirDonoAtual)', () => {
    it('mantém a fila quando o mesmo usuário volta a enfileirar', async () => {
      mockedGetCurrentUser.mockResolvedValue({ sub: 'user-a' });
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

    it('descarta a fila de um usuário anterior ao enfileirar como outro usuário', async () => {
      mockedGetCurrentUser.mockResolvedValue({ sub: 'user-a' });
      await offlineQueue.enqueue({
        type: 'registrar_serie',
        sessaoRef: 'sessao-1',
        payload: registrarPayload,
      });
      expect(await offlineQueue.getPendingCount()).toBe(1);

      mockedGetCurrentUser.mockResolvedValue({ sub: 'user-b' });
      const novoItem = await offlineQueue.enqueue({
        type: 'registrar_serie',
        sessaoRef: 'sessao-2',
        payload: registrarPayload,
      });

      const todos = await offlineQueue.getAll();
      expect(todos.map((item) => item.id)).toEqual([novoItem.id]);
    });

    it('não descarta uma fila gravada antes desta mudança (sem ownerId)', async () => {
      storedRaw = JSON.stringify({
        items: [
          {
            id: 'item-antigo',
            type: 'registrar_serie',
            sessaoRef: 'sessao-1',
            payload: registrarPayload,
            createdAt: new Date().toISOString(),
            attempts: 0,
          },
        ],
        needsReauth: false,
        // sem `ownerId` — simula um envelope gravado antes deste campo existir
      });
      mockedGetCurrentUser.mockResolvedValue({ sub: 'user-a' });

      const novo = await offlineQueue.enqueue({
        type: 'registrar_serie',
        sessaoRef: 'sessao-2',
        payload: registrarPayload,
      });

      const todos = await offlineQueue.getAll();
      expect(todos.map((item) => item.id)).toEqual(['item-antigo', novo.id]);
    });

    it('garantirDonoAtual descarta sozinha, sem precisar enfileirar nada', async () => {
      mockedGetCurrentUser.mockResolvedValue({ sub: 'user-a' });
      await offlineQueue.enqueue({
        type: 'registrar_serie',
        sessaoRef: 'sessao-1',
        payload: registrarPayload,
      });

      mockedGetCurrentUser.mockResolvedValue({ sub: 'user-b' });
      await offlineQueue.garantirDonoAtual();

      expect(await offlineQueue.getAll()).toEqual([]);
    });

    it('um clear() após um descarte não deixa nenhum item "grudado" pra próxima fila', async () => {
      // Regressão: "envelope vazio" precisa ser um objeto novo a cada
      // vez, não uma constante reaproveitada — um `envelope.items.push`
      // de uma fila descartada mutaria essa MESMA constante pra sempre, e
      // um `clear()` bem depois (outro logout, outro usuário) devolveria
      // esses itens antigos em vez de uma fila de verdade vazia.
      mockedGetCurrentUser.mockResolvedValue({ sub: 'user-a' });
      await offlineQueue.enqueue({
        type: 'registrar_serie',
        sessaoRef: 'sessao-1',
        payload: registrarPayload,
      });
      mockedGetCurrentUser.mockResolvedValue({ sub: 'user-b' });
      await offlineQueue.enqueue({
        type: 'registrar_serie',
        sessaoRef: 'sessao-2',
        payload: registrarPayload,
      }); // descarta a fila de user-a por baixo dos panos

      await offlineQueue.clear();

      expect(await offlineQueue.getAll()).toEqual([]);
      // Uma terceira fila (outro usuário, outro dia) não pode nascer com
      // os itens de user-b grudados por causa do clear() anterior.
      mockedGetCurrentUser.mockResolvedValue({ sub: 'user-c' });
      const item = await offlineQueue.enqueue({
        type: 'registrar_serie',
        sessaoRef: 'sessao-3',
        payload: registrarPayload,
      });
      expect(await offlineQueue.getAll()).toEqual([item]);
    });

    it('nunca lança, mesmo se getCurrentUser falhar — e não mexe na fila', async () => {
      mockedGetCurrentUser.mockResolvedValue({ sub: 'user-a' });
      await offlineQueue.enqueue({
        type: 'registrar_serie',
        sessaoRef: 'sessao-1',
        payload: registrarPayload,
      });

      mockedGetCurrentUser.mockRejectedValue(new Error('SecureStore indisponível'));
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(offlineQueue.garantirDonoAtual()).resolves.toBeUndefined();

      expect(await offlineQueue.getPendingCount()).toBe(1);
      warnSpy.mockRestore();
    });
  });
});
