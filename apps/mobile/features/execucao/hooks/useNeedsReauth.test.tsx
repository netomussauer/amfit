import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useNeedsReauth } from './useNeedsReauth';
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

describe('useNeedsReauth', () => {
  beforeEach(async () => {
    storedRaw = null;
    mockedGetItem.mockImplementation(async () => storedRaw);
    mockedSetItem.mockImplementation(async (_key: string, value: string) => {
      storedRaw = value;
    });
    await offlineQueue.clear();
  });

  it('começa em false', async () => {
    const { result } = await renderHook(() => useNeedsReauth());

    expect(result.current).toBe(false);
  });

  it('reage a setNeedsReauth(true)', async () => {
    const { result } = await renderHook(() => useNeedsReauth());
    expect(result.current).toBe(false);

    await act(async () => {
      await offlineQueue.setNeedsReauth(true);
    });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('reage a setNeedsReauth(false)', async () => {
    await offlineQueue.setNeedsReauth(true);
    const { result } = await renderHook(() => useNeedsReauth());
    await waitFor(() => expect(result.current).toBe(true));

    await act(async () => {
      await offlineQueue.setNeedsReauth(false);
    });

    await waitFor(() => expect(result.current).toBe(false));
  });
});
