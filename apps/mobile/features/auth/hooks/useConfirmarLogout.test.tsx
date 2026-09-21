import type { ReactNode } from 'react';
import { Alert, type AlertButton } from 'react-native';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react-native';
import { useConfirmarLogout } from './useConfirmarLogout';
import { useLogout } from './useLogout';
import { clearAll } from '@/shared/lib/auth';
import * as offlineQueue from '@/features/execucao/lib/offlineQueue';

// Factory (não automock): o automock carregaria o módulo real só pra
// descobrir o formato, e useLogout puxa o expo-router (ESM, sem transform
// no jest).
jest.mock('./useLogout', () => ({ useLogout: jest.fn() }));
jest.mock('@/shared/lib/auth', () => ({ clearAll: jest.fn() }));
jest.mock('@/features/execucao/lib/offlineQueue', () => ({
  getPendingCount: jest.fn(),
  getNeedsReauth: jest.fn(),
}));

const mockedReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockedReplace }),
}));

const mockUseLogout = useLogout as jest.Mock;
const mockedClearAll = clearAll as jest.Mock;
const mockedGetPendingCount = offlineQueue.getPendingCount as jest.Mock;
const mockedGetNeedsReauth = offlineQueue.getNeedsReauth as jest.Mock;

const doLogout = jest.fn();
let alertSpy: { mock: { calls: unknown[][] }; mockRestore: () => void };
let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function ultimoAlert() {
  const [titulo, mensagem, botoes] = alertSpy.mock.calls[0] as [
    string,
    string,
    AlertButton[],
  ];
  return { titulo, mensagem, botoes };
}

async function acionarLogout(result: { current: { logout: () => Promise<void> } }) {
  await act(async () => {
    await result.current.logout();
  });
}

describe('useConfirmarLogout', () => {
  beforeEach(() => {
    queryClient = new QueryClient();
    doLogout.mockReset();
    mockedReplace.mockReset();
    mockedClearAll.mockReset();
    mockUseLogout.mockReturnValue({ mutate: doLogout, isPending: false });
    mockedGetPendingCount.mockResolvedValue(0);
    mockedGetNeedsReauth.mockResolvedValue(false);
    onlineManager.setOnline(true);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('sai direto, sem confirmação, quando não há ações pendentes', async () => {
    const { result } = await renderHook(() => useConfirmarLogout(), { wrapper: Wrapper });

    await acionarLogout(result);

    expect(doLogout).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('pede confirmação, sem sair ainda, quando há ações pendentes', async () => {
    mockedGetPendingCount.mockResolvedValue(3);
    const { result } = await renderHook(() => useConfirmarLogout(), { wrapper: Wrapper });

    await acionarLogout(result);

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(doLogout).not.toHaveBeenCalled();
    const { mensagem } = ultimoAlert();
    expect(mensagem).toContain('3 ações ainda não foram sincronizadas');
    expect(mensagem).toContain('elas serão perdidas');
  });

  it('usa o singular quando há uma única ação pendente', async () => {
    mockedGetPendingCount.mockResolvedValue(1);
    const { result } = await renderHook(() => useConfirmarLogout(), { wrapper: Wrapper });

    await acionarLogout(result);

    const { mensagem } = ultimoAlert();
    expect(mensagem).toContain('1 ação ainda não foi sincronizada');
    expect(mensagem).toContain('ela será perdida');
    expect(mensagem).toContain('enviá-la');
  });

  it('só sai de fato ao confirmar em "Sair mesmo assim"', async () => {
    mockedGetPendingCount.mockResolvedValue(2);
    const { result } = await renderHook(() => useConfirmarLogout(), { wrapper: Wrapper });
    await acionarLogout(result);
    const { botoes } = ultimoAlert();

    const confirmar = botoes.find((b) => b.text === 'Sair mesmo assim');
    expect(confirmar?.style).toBe('destructive');
    await act(async () => {
      confirmar?.onPress?.();
    });

    expect(doLogout).toHaveBeenCalledTimes(1);
  });

  it('nenhum botão além do de confirmar dispara o logout (cancelar é seguro)', async () => {
    mockedGetPendingCount.mockResolvedValue(2);
    const { result } = await renderHook(() => useConfirmarLogout(), { wrapper: Wrapper });
    await acionarLogout(result);
    const { botoes } = ultimoAlert();

    const cancelar = botoes.find((b) => b.text === 'Cancelar');
    expect(cancelar?.style).toBe('cancel');
    await act(async () => {
      cancelar?.onPress?.();
    });

    expect(doLogout).not.toHaveBeenCalled();
    expect(mockedClearAll).not.toHaveBeenCalled();
  });

  it('sugere "Sincronizar agora" quando online', async () => {
    mockedGetPendingCount.mockResolvedValue(2);
    const { result } = await renderHook(() => useConfirmarLogout(), { wrapper: Wrapper });

    await acionarLogout(result);

    expect(ultimoAlert().mensagem).toContain('Sincronizar agora');
  });

  it('não sugere sincronizar quando está offline', async () => {
    mockedGetPendingCount.mockResolvedValue(2);
    onlineManager.setOnline(false);
    const { result } = await renderHook(() => useConfirmarLogout(), { wrapper: Wrapper });

    await acionarLogout(result);

    expect(ultimoAlert().mensagem).not.toContain('Sincronizar agora');
  });

  it('lê a fila sob demanda: avisa mesmo que nenhum snapshot em cache tenha sido carregado', async () => {
    // Regressão: usar o snapshot síncrono (que começa em 0 até a primeira
    // leitura do AsyncStorage) pularia o aviso num logout logo após abrir
    // o app.
    mockedGetPendingCount.mockResolvedValue(4);
    const { result } = await renderHook(() => useConfirmarLogout(), { wrapper: Wrapper });

    await acionarLogout(result);

    expect(mockedGetPendingCount).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('ignora um segundo toque enquanto o diálogo ainda está aberto', async () => {
    mockedGetPendingCount.mockResolvedValue(2);
    const { result } = await renderHook(() => useConfirmarLogout(), { wrapper: Wrapper });

    await act(async () => {
      await Promise.all([result.current.logout(), result.current.logout()]);
    });

    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('libera o diálogo ao cancelar, permitindo tentar sair de novo', async () => {
    mockedGetPendingCount.mockResolvedValue(2);
    const { result } = await renderHook(() => useConfirmarLogout(), { wrapper: Wrapper });
    await acionarLogout(result);
    await act(async () => {
      ultimoAlert().botoes.find((b) => b.text === 'Cancelar')?.onPress?.();
    });

    await acionarLogout(result);

    expect(alertSpy).toHaveBeenCalledTimes(2);
  });

  describe('quando a sessão expirou (needsReauth)', () => {
    beforeEach(() => {
      mockedGetPendingCount.mockResolvedValue(2);
      mockedGetNeedsReauth.mockResolvedValue(true);
    });

    it('oferece "Entrar novamente" além de "Sair e perder"', async () => {
      const { result } = await renderHook(() => useConfirmarLogout(), { wrapper: Wrapper });

      await acionarLogout(result);

      const { titulo, mensagem, botoes } = ultimoAlert();
      expect(titulo).toBe('Sessão expirada');
      expect(mensagem).toContain('sua sessão expirou');
      expect(mensagem).not.toContain('Sincronizar agora');
      expect(botoes.map((b) => b.text)).toEqual([
        'Cancelar',
        'Entrar novamente',
        'Sair e perder',
      ]);
      expect(botoes.find((b) => b.text === 'Sair e perder')?.style).toBe('destructive');
    });

    it('"Entrar novamente" limpa a sessão e volta pro login SEM descartar a fila', async () => {
      const clearSpy = jest.spyOn(queryClient, 'clear');
      const { result } = await renderHook(() => useConfirmarLogout(), { wrapper: Wrapper });
      await acionarLogout(result);

      await act(async () => {
        ultimoAlert().botoes.find((b) => b.text === 'Entrar novamente')?.onPress?.();
      });

      expect(mockedClearAll).toHaveBeenCalledTimes(1);
      expect(clearSpy).toHaveBeenCalled();
      expect(mockedReplace).toHaveBeenCalledWith('/(auth)/login');
      expect(doLogout).not.toHaveBeenCalled();
    });

    it('"Sair e perder" faz o logout normal (que descarta a fila)', async () => {
      const { result } = await renderHook(() => useConfirmarLogout(), { wrapper: Wrapper });
      await acionarLogout(result);

      await act(async () => {
        ultimoAlert().botoes.find((b) => b.text === 'Sair e perder')?.onPress?.();
      });

      expect(doLogout).toHaveBeenCalledTimes(1);
      expect(mockedReplace).not.toHaveBeenCalled();
    });
  });

  it('expõe isLoggingOut vindo do useLogout', async () => {
    mockUseLogout.mockReturnValue({ mutate: doLogout, isPending: true });

    const { result } = await renderHook(() => useConfirmarLogout(), { wrapper: Wrapper });

    expect(result.current.isLoggingOut).toBe(true);
  });

  it('não faz nada se o logout já está em andamento', async () => {
    mockUseLogout.mockReturnValue({ mutate: doLogout, isPending: true });
    const { result } = await renderHook(() => useConfirmarLogout(), { wrapper: Wrapper });

    await acionarLogout(result);

    expect(doLogout).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
