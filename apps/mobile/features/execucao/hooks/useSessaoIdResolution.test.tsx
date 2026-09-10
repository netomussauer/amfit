import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useSessaoIdResolution } from './useSessaoIdResolution';
import { sessaoIdResolutionKeys } from './query-keys';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const Wrapper = function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };

  return { queryClient, Wrapper };
}

describe('useSessaoIdResolution', () => {
  it('começa sem dado e nunca busca sozinho', async () => {
    const { Wrapper } = createWrapper();

    const { result } = await renderHook(() => useSessaoIdResolution('local-1-abc'), {
      wrapper: Wrapper,
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('reflete o ID real gravado via setQueryData na chave certa', async () => {
    const { queryClient, Wrapper } = createWrapper();
    const { result } = await renderHook(() => useSessaoIdResolution('local-1-abc'), {
      wrapper: Wrapper,
    });

    queryClient.setQueryData(
      sessaoIdResolutionKeys.detail('local-1-abc'),
      '50000000-0000-0000-0000-000000000099',
    );

    await waitFor(() =>
      expect(result.current.data).toBe('50000000-0000-0000-0000-000000000099'),
    );
  });

  it('não reflete dado gravado sob um localId diferente', async () => {
    const { queryClient, Wrapper } = createWrapper();
    const { result } = await renderHook(() => useSessaoIdResolution('local-1-abc'), {
      wrapper: Wrapper,
    });

    queryClient.setQueryData(
      sessaoIdResolutionKeys.detail('local-2-xyz'),
      '50000000-0000-0000-0000-000000000099',
    );

    // Nada pra esperar convergir (o dado observado nunca deve mudar) —
    // um pequeno delay real garante que, se a chave errada notificasse
    // o observer por engano, já teria acontecido.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.data).toBeUndefined();
  });
});
