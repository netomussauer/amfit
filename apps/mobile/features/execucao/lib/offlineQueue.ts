import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RegistrarSerieRequest } from '@amfit/shared';

const STORAGE_KEY = 'execucao_offline_queue';

type QueueItemBase = {
  id: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

// `iniciar_sessao`/`concluir_sessao` já entram na união aqui (schema
// completo desde já), mas só `registrar_serie` tem produtor/consumidor
// nesta fase — os outros dois ficam pra Fases 3-4 do modo offline.
export type IniciarItem = QueueItemBase & {
  type: 'iniciar_sessao';
  localSessaoId: string;
  payload: { treino_id: string };
};

export type RegistrarItem = QueueItemBase & {
  type: 'registrar_serie';
  sessaoRef: string;
  payload: RegistrarSerieRequest;
};

export type ConcluirItem = QueueItemBase & {
  type: 'concluir_sessao';
  sessaoRef: string;
};

export type OfflineQueueItem = IniciarItem | RegistrarItem | ConcluirItem;

type QueueEnvelope = {
  items: OfflineQueueItem[];
  needsReauth: boolean;
};

const EMPTY_ENVELOPE: QueueEnvelope = { items: [], needsReauth: false };

function generateItemId(): string {
  return `queue-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Nunca lança — storage corrompido/ausente vira fila vazia (mesmo estilo
// de features/tenant/lib/theme-cache.ts).
async function readEnvelope(): Promise<QueueEnvelope> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_ENVELOPE;
    const parsed = JSON.parse(raw) as Partial<QueueEnvelope>;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      needsReauth: parsed.needsReauth === true,
    };
  } catch {
    return EMPTY_ENVELOPE;
  }
}

// Snapshot síncrono do total de itens — useSyncExternalStore (usado por
// usePendingSyncCount) exige um getSnapshot síncrono, mas a fila em si
// vive no AsyncStorage (assíncrono). Inicializado com uma leitura real
// assim que o módulo carrega, pra refletir uma fila persistida de uma
// sessão anterior do app desde o primeiro render — sem isso, ficaria
// incorretamente "0" até a próxima mutação, escondendo pendências reais
// de um cold start offline.
let cachedCount = 0;
void readEnvelope().then((envelope) => {
  cachedCount = envelope.items.length;
  notifyListeners();
});

export function getSnapshotCount(): number {
  return cachedCount;
}

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

async function writeEnvelope(envelope: QueueEnvelope): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  cachedCount = envelope.items.length;
  notifyListeners();
}

// Serializa os ciclos leitura-modificação-escrita do envelope. Sem isso,
// duas chamadas concorrentes (ex.: o usuário registrando uma série
// enquanto o drain em segundo plano está no meio de um
// `rewriteSessaoRef`) podem interlear entre o `readEnvelope()` de uma e
// o `writeEnvelope()` da outra — mesmo rodando tudo numa única thread JS,
// operações assíncronas ainda interlear nos pontos de `await` — e quem
// escrever por último apaga silenciosamente a mudança da primeira.
let queueLock: Promise<unknown> = Promise.resolve();

function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = queueLock.then(fn, fn);
  queueLock = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/** Pub/sub simples pra usePendingSyncCount via useSyncExternalStore — não
 * depende do MutationCache do React Query de propósito (ver decisão de
 * arquitetura no plano do modo offline). */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function enqueue(
  item:
    | Omit<IniciarItem, 'id' | 'createdAt' | 'attempts'>
    | Omit<RegistrarItem, 'id' | 'createdAt' | 'attempts'>
    | Omit<ConcluirItem, 'id' | 'createdAt' | 'attempts'>,
): Promise<OfflineQueueItem> {
  return withQueueLock(async () => {
    const envelope = await readEnvelope();
    const fullItem = {
      ...item,
      id: generateItemId(),
      createdAt: new Date().toISOString(),
      attempts: 0,
    } as OfflineQueueItem;
    envelope.items.push(fullItem);
    await writeEnvelope(envelope);
    return fullItem;
  });
}

export function dequeue(id: string): Promise<void> {
  return withQueueLock(async () => {
    const envelope = await readEnvelope();
    envelope.items = envelope.items.filter((item) => item.id !== id);
    await writeEnvelope(envelope);
  });
}

export function updateItem(
  id: string,
  patch: Partial<Omit<QueueItemBase, 'id'>>,
): Promise<void> {
  return withQueueLock(async () => {
    const envelope = await readEnvelope();
    envelope.items = envelope.items.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    );
    await writeEnvelope(envelope);
  });
}

/** Troca `sessaoRef` de `oldRef` para `newRef` em todo item da fila que o
 * possuir (`registrar_serie`/`concluir_sessao`) — usado quando um
 * `iniciar_sessao` sincroniza e o ID local vira um ID real de servidor,
 * pra itens já enfileirados sob o ID local passarem a apontar pro ID
 * certo. `iniciar_sessao` não tem `sessaoRef` (usa `localSessaoId`) e
 * fica de fora. */
export function rewriteSessaoRef(oldRef: string, newRef: string): Promise<void> {
  return withQueueLock(async () => {
    const envelope = await readEnvelope();
    envelope.items = envelope.items.map((item) =>
      item.type !== 'iniciar_sessao' && item.sessaoRef === oldRef
        ? { ...item, sessaoRef: newRef }
        : item,
    );
    await writeEnvelope(envelope);
  });
}

export async function getAll(): Promise<OfflineQueueItem[]> {
  const envelope = await readEnvelope();
  return envelope.items;
}

export async function getPendingCount(): Promise<number> {
  const envelope = await readEnvelope();
  return envelope.items.length;
}

export function setNeedsReauth(value: boolean): Promise<void> {
  return withQueueLock(async () => {
    const envelope = await readEnvelope();
    envelope.needsReauth = value;
    await writeEnvelope(envelope);
  });
}

export async function getNeedsReauth(): Promise<boolean> {
  const envelope = await readEnvelope();
  return envelope.needsReauth;
}

/** Só pra testes/depuração explícita — nunca chamada implicitamente. */
export function clear(): Promise<void> {
  return withQueueLock(() => writeEnvelope(EMPTY_ENVELOPE));
}
