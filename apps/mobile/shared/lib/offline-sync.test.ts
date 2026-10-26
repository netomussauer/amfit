import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { runDrain } from '@/features/execucao/lib/offlineSyncEngine';
import { configureOfflineSync } from './offline-sync';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn() },
}));

jest.mock('@/features/execucao/lib/offlineSyncEngine', () => ({
  runDrain: jest.fn(),
}));

jest.mock('./query-client', () => ({
  queryClient: { mockId: 'query-client-de-teste' },
}));

type NetState = { isConnected: boolean | null; isInternetReachable: boolean | null };
type NetListener = (state: NetState) => void;

const mockedAddEventListener = NetInfo.addEventListener as unknown as jest.Mock;
const mockedRunDrain = runDrain as jest.MockedFunction<typeof runDrain>;

/** Arma o sync e devolve o listener que o NetInfo recebeu. */
function armar(): NetListener {
  configureOfflineSync();
  expect(mockedAddEventListener).toHaveBeenCalledTimes(1);
  return mockedAddEventListener.mock.calls[0][0] as NetListener;
}

describe('configureOfflineSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAddEventListener.mockReturnValue(jest.fn());
    onlineManager.setOnline(true);
  });

  it('drena a fila uma vez no boot, com o queryClient compartilhado', () => {
    armar();

    expect(mockedRunDrain).toHaveBeenCalledTimes(1);
    expect(mockedRunDrain).toHaveBeenCalledWith({ mockId: 'query-client-de-teste' });
  });

  it('assina o NetInfo uma unica vez', () => {
    armar();

    expect(mockedAddEventListener).toHaveBeenCalledTimes(1);
  });

  it('conexao com internet: marca online e drena de novo', () => {
    const listener = armar();
    onlineManager.setOnline(false);
    mockedRunDrain.mockClear();

    listener({ isConnected: true, isInternetReachable: true });

    expect(onlineManager.isOnline()).toBe(true);
    expect(mockedRunDrain).toHaveBeenCalledTimes(1);
  });

  it('isInternetReachable null (NetInfo ainda nao confirmou) conta como online', () => {
    const listener = armar();
    onlineManager.setOnline(false);
    mockedRunDrain.mockClear();

    listener({ isConnected: true, isInternetReachable: null });

    expect(onlineManager.isOnline()).toBe(true);
    expect(mockedRunDrain).toHaveBeenCalledTimes(1);
  });

  it('sem conexao: marca offline e NAO drena', () => {
    const listener = armar();
    mockedRunDrain.mockClear();

    listener({ isConnected: false, isInternetReachable: false });

    expect(onlineManager.isOnline()).toBe(false);
    expect(mockedRunDrain).not.toHaveBeenCalled();
  });

  it('conectado a uma rede sem internet (isInternetReachable=false): offline', () => {
    const listener = armar();
    mockedRunDrain.mockClear();

    listener({ isConnected: true, isInternetReachable: false });

    expect(onlineManager.isOnline()).toBe(false);
    expect(mockedRunDrain).not.toHaveBeenCalled();
  });

  it('isConnected null e tratado como offline', () => {
    const listener = armar();
    mockedRunDrain.mockClear();

    listener({ isConnected: null, isInternetReachable: true });

    expect(onlineManager.isOnline()).toBe(false);
    expect(mockedRunDrain).not.toHaveBeenCalled();
  });

  it('volta a drenar a cada reconexao (offline -> online -> offline -> online)', () => {
    const listener = armar();
    mockedRunDrain.mockClear();

    listener({ isConnected: false, isInternetReachable: false });
    listener({ isConnected: true, isInternetReachable: true });
    listener({ isConnected: false, isInternetReachable: false });
    listener({ isConnected: true, isInternetReachable: true });

    expect(mockedRunDrain).toHaveBeenCalledTimes(2);
    expect(onlineManager.isOnline()).toBe(true);
  });
});
