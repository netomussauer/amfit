import { createElement } from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestQueryClient } from '@/shared/test-utils/setup-query';
import { clearTokens } from '@/shared/lib/auth';
import { useLogout } from './useLogout';

const { mockedPost, mockedReplace, mockedUseRouter } = vi.hoisted(() => ({
  mockedPost: vi.fn(),
  mockedReplace: vi.fn(),
  mockedUseRouter: vi.fn(),
}));

vi.mock('@/shared/lib/api-client', () => ({
  apiClient: { post: mockedPost },
}));

vi.mock('@/shared/lib/auth', () => ({
  clearTokens: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: mockedUseRouter,
}));

const mockedClearTokens = vi.mocked(clearTokens);

function renderUseLogout() {
  const client = createTestQueryClient();
  const clearSpy = vi.spyOn(client, 'clear');
  const { result } = renderHook(() => useLogout(), {
    wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
  });
  return { logout: result.current, clearSpy };
}

describe('useLogout', () => {
  beforeEach(() => {
    mockedPost.mockReset();
    mockedReplace.mockReset();
    mockedClearTokens.mockReset();
    mockedUseRouter.mockReturnValue({ replace: mockedReplace });
  });

  it('chama POST /auth/logout, limpa tokens, cache e redireciona para /login', async () => {
    mockedPost.mockResolvedValueOnce({ data: undefined });

    const { logout, clearSpy } = renderUseLogout();
    await logout();

    expect(mockedPost).toHaveBeenCalledWith('/auth/logout');
    expect(mockedClearTokens).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(mockedReplace).toHaveBeenCalledWith('/login');
  });

  it('limpa tokens e redireciona mesmo quando a chamada ao servidor falha (best-effort)', async () => {
    mockedPost.mockRejectedValueOnce(new Error('falha de rede'));

    const { logout, clearSpy } = renderUseLogout();
    await logout();

    expect(mockedClearTokens).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(mockedReplace).toHaveBeenCalledWith('/login');
  });
});
