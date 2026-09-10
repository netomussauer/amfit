import { renderHook, waitFor } from '@testing-library/react-native';
import { usePendingIniciarLocalId } from './usePendingIniciarLocalId';
import * as offlineQueue from '../lib/offlineQueue';

jest.mock('expo-router', () => ({
  // Sem NavigationContainer no ambiente de teste — useFocusEffect vira um
  // useEffect comum, disparando no mount e sempre que a identidade do
  // callback mudar (mesmo gatilho de "ganhar foco" que importa aqui).
  // `require` aqui dentro (não um import no topo do arquivo) porque
  // fábricas de `jest.mock()` não podem referenciar variáveis de fora do
  // escopo do factory.
  useFocusEffect: (callback: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('react').useEffect(() => callback(), [callback]);
  },
}));

jest.mock('../lib/offlineQueue', () => ({
  getAll: jest.fn(),
}));

const mockedGetAll = offlineQueue.getAll as jest.MockedFunction<typeof offlineQueue.getAll>;

const treinoId = '60000000-0000-0000-0000-000000000001';

describe('usePendingIniciarLocalId', () => {
  beforeEach(() => {
    mockedGetAll.mockReset();
  });

  it('devolve null quando não há treinoId', async () => {
    const { result } = await renderHook(() => usePendingIniciarLocalId(undefined));

    expect(result.current).toBeNull();
    expect(mockedGetAll).not.toHaveBeenCalled();
  });

  it('devolve null quando não há item iniciar_sessao pendente pro treino', async () => {
    mockedGetAll.mockResolvedValue([]);

    const { result } = await renderHook(() => usePendingIniciarLocalId(treinoId));

    await waitFor(() => expect(mockedGetAll).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('devolve o localSessaoId do item iniciar_sessao pendente pro treino informado', async () => {
    mockedGetAll.mockResolvedValue([
      {
        id: 'queue-1',
        type: 'iniciar_sessao',
        localSessaoId: 'local-1-abc',
        payload: { treino_id: treinoId },
        createdAt: new Date().toISOString(),
        attempts: 0,
      },
    ]);

    const { result } = await renderHook(() => usePendingIniciarLocalId(treinoId));

    await waitFor(() => expect(result.current).toBe('local-1-abc'));
  });

  it('ignora item iniciar_sessao de outro treino', async () => {
    mockedGetAll.mockResolvedValue([
      {
        id: 'queue-1',
        type: 'iniciar_sessao',
        localSessaoId: 'local-1-abc',
        payload: { treino_id: '60000000-0000-0000-0000-000000000002' },
        createdAt: new Date().toISOString(),
        attempts: 0,
      },
    ]);

    const { result } = await renderHook(() => usePendingIniciarLocalId(treinoId));

    await waitFor(() => expect(mockedGetAll).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});
