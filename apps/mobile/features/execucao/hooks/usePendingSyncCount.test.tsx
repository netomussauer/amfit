import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePendingSyncCount } from './usePendingSyncCount';
import * as offlineQueue from '../lib/offlineQueue';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const mockedGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
const mockedSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;

let storedRaw: string | null = null;

describe('usePendingSyncCount', () => {
  beforeEach(async () => {
    storedRaw = null;
    mockedGetItem.mockImplementation(async () => storedRaw);
    mockedSetItem.mockImplementation(async (_key: string, value: string) => {
      storedRaw = value;
    });
    await offlineQueue.clear();
  });

  it('começa em 0 quando a fila está vazia', async () => {
    const { result } = await renderHook(() => usePendingSyncCount());

    expect(result.current).toBe(0);
  });

  it('reage a itens enfileirados', async () => {
    const { result } = await renderHook(() => usePendingSyncCount());
    expect(result.current).toBe(0);

    await act(async () => {
      await offlineQueue.enqueue({
        type: 'registrar_serie',
        sessaoRef: 'sessao-1',
        payload: {
          item_treino_id: '30000000-0000-0000-0000-000000000001',
          numero_serie: 1,
          concluida: true,
        },
      });
    });

    await waitFor(() => expect(result.current).toBe(1));
  });

  it('reage a itens removidos da fila', async () => {
    const item = await offlineQueue.enqueue({
      type: 'registrar_serie',
      sessaoRef: 'sessao-1',
      payload: {
        item_treino_id: '30000000-0000-0000-0000-000000000001',
        numero_serie: 1,
        concluida: true,
      },
    });
    const { result } = await renderHook(() => usePendingSyncCount());
    await waitFor(() => expect(result.current).toBe(1));

    await act(async () => {
      await offlineQueue.dequeue(item.id);
    });

    await waitFor(() => expect(result.current).toBe(0));
  });
});
