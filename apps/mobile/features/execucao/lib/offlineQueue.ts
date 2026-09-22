import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RegistrarSerieRequest } from '@amfit/shared';
import { getCurrentUser } from '@/shared/lib/auth';

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
  /** `sub` do JWT do usuário dono da fila — ver `garantirDonoAtual`. */
  ownerId: string | null;
};

// Fábrica, não uma constante compartilhada: um envelope "vazio" precisa de
// um array `items` NOVO a cada chamada. Um objeto único reaproveitado em
// todo lugar que precisa de um envelope vazio (achado real de
// code-review) faria um `envelope.items.push(...)` posterior mutar esse
// MESMO array pra sempre — inclusive nos outros lugares que devolvem
// "vazio" (storage corrompido/ausente, `clear()`), deixando itens de uma
// fila anterior "grudados" num `clear()` de logout futuro.
function emptyEnvelope(): QueueEnvelope {
  return { items: [], needsReauth: false, ownerId: null };
}

function generateItemId(): string {
  return `queue-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Nunca lança — storage corrompido/ausente vira fila vazia (mesmo estilo
// de features/tenant/lib/theme-cache.ts).
async function readEnvelope(): Promise<QueueEnvelope> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyEnvelope();
    const parsed = JSON.parse(raw) as Partial<QueueEnvelope>;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      needsReauth: parsed.needsReauth === true,
      // `null`/ausente cobre filas gravadas antes desta mudança — não é
      // tratado como "dono divergente" (ver garantirDonoAtual), só ainda
      // não tem dono registrado.
      ownerId: typeof parsed.ownerId === 'string' ? parsed.ownerId : null,
    };
  } catch {
    return emptyEnvelope();
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
let cachedNeedsReauth = false;
void readEnvelope().then((envelope) => {
  cachedCount = envelope.items.length;
  cachedNeedsReauth = envelope.needsReauth;
  notifyListeners();
});

export function getSnapshotCount(): number {
  return cachedCount;
}

/** Snapshot síncrono de `needsReauth` — mesmo motivo de `getSnapshotCount`
 * (useSyncExternalStore, usado por `useNeedsReauth`, exige um getSnapshot
 * síncrono). */
export function getSnapshotNeedsReauth(): boolean {
  return cachedNeedsReauth;
}

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

async function writeEnvelope(envelope: QueueEnvelope): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  cachedCount = envelope.items.length;
  cachedNeedsReauth = envelope.needsReauth;
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

/** Pub/sub simples pra usePendingSyncCount/useNeedsReauth via
 * useSyncExternalStore — não depende do MutationCache do React Query de
 * propósito (ver decisão de arquitetura no plano do modo offline). */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Confere o envelope já lido contra o usuário logado agora, devolvendo a
 * versão a gravar (ela mesma, sem mudança nenhuma na maioria das vezes).
 * Chamada só de dentro de um `withQueueLock` — não faz leitura/escrita
 * própria, pra poder ser fundida na mesma seção crítica de quem já leu o
 * envelope, em vez de virar uma segunda transação separada (que deixaria
 * uma janela pra outra operação, como um `clear()` de logout, se
 * intercalar entre a verificação e a escrita de quem chamou).
 *
 * Sem itens, ou sem `ownerId` ainda registrado (fila vazia, ou gravada
 * antes desta mudança): só grava o dono atual. Com itens de um dono
 * diferente do atual: descarta tudo — sincronizar sob a identidade
 * errada é pior do que perder a ação. Nunca lança: se não der pra
 * descobrir o usuário atual, devolve o envelope como veio.
 */
async function envelopeComDonoVerificado(envelope: QueueEnvelope): Promise<QueueEnvelope> {
  let ownerId: string | null;
  try {
    const user = await getCurrentUser();
    ownerId = user?.sub ?? null;
  } catch (err) {
    console.warn('[offlineQueue] não foi possível determinar o usuário atual', err);
    return envelope;
  }

  if (envelope.items.length > 0 && envelope.ownerId && envelope.ownerId !== ownerId) {
    console.warn(
      `[offlineQueue] fila pertencia a outro usuário — descartando ${envelope.items.length} ${
        envelope.items.length === 1 ? 'item' : 'itens'
      }`,
    );
    return { ...emptyEnvelope(), ownerId };
  }
  if (envelope.ownerId !== ownerId) {
    return { ...envelope, ownerId };
  }
  return envelope;
}

/**
 * Garante que a fila pertence ao usuário logado agora, descartando-a se
 * não (ver `envelopeComDonoVerificado`). A fila não tem dono por
 * padrão — o logout voluntário já limpa (`useLogout`), mas uma sessão
 * que termina de outro jeito (401 interativo, app fechado à força,
 * crash) deixaria a fila órfã, e o próximo usuário a logar neste
 * aparelho teria as ações dele sincronizadas por engano.
 *
 * `enqueue` já faz essa verificação como parte da sua própria transação
 * (não precisa chamar esta função à parte). Usada diretamente no início
 * de cada volta de `runDrain` — um drain pode processar vários itens em
 * sequência (cada um com sua própria chamada de rede); se o usuário
 * logado trocar no meio disso, o restante da fila não pode continuar
 * sendo sincronizado sob a conta nova.
 */
export function garantirDonoAtual(): Promise<void> {
  return withQueueLock(async () => {
    const envelope = await readEnvelope();
    const verificado = await envelopeComDonoVerificado(envelope);
    if (verificado !== envelope) {
      await writeEnvelope(verificado);
    }
  });
}

export function enqueue(
  item:
    | Omit<IniciarItem, 'id' | 'createdAt' | 'attempts'>
    | Omit<RegistrarItem, 'id' | 'createdAt' | 'attempts'>
    | Omit<ConcluirItem, 'id' | 'createdAt' | 'attempts'>,
): Promise<OfflineQueueItem> {
  return withQueueLock(async () => {
    const envelope = await envelopeComDonoVerificado(await readEnvelope());
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
  return withQueueLock(() => writeEnvelope(emptyEnvelope()));
}
