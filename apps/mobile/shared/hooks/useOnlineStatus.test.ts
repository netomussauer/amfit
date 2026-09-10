import { renderHook, act } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { useOnlineStatus } from './useOnlineStatus';

describe('useOnlineStatus', () => {
  afterEach(async () => {
    // Restaura o estado padrão (online) pra não vazar entre testes — em
    // act() porque isso notifica os listeners inscritos (inclusive de um
    // componente ainda montado do teste anterior), disparando um
    // re-render fora do fluxo de eventos do React.
    await act(async () => {
      onlineManager.setOnline(true);
    });
  });

  it('reflete o estado inicial online do onlineManager', async () => {
    onlineManager.setOnline(true);

    const { result } = await renderHook(() => useOnlineStatus());

    expect(result.current).toBe(true);
  });

  it('reage quando o onlineManager muda pra offline', async () => {
    onlineManager.setOnline(true);
    const { result } = await renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    // useSyncExternalStore já re-renderiza sozinho quando o listener do
    // onlineManager notifica a mudança — não precisa de rerender manual.
    await act(async () => {
      onlineManager.setOnline(false);
    });

    expect(result.current).toBe(false);
  });
});
