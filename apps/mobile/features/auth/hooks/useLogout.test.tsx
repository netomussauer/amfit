import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useLogout } from './useLogout';
import { apiRequest } from '@/shared/lib/api-client';
import { clearAll, getRefreshToken } from '@/shared/lib/auth';

jest.mock('@/shared/lib/api-client', () => ({
  apiRequest: jest.fn(),
}));

jest.mock('@/shared/lib/auth', () => ({
  clearAll: jest.fn(),
  getRefreshToken: jest.fn(),
}));

const mockedReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockedReplace }),
}));

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;
const mockedClearAll = clearAll as jest.MockedFunction<typeof clearAll>;
const mockedGetRefreshToken = getRefreshToken as jest.MockedFunction<
  typeof getRefreshToken
>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });

  return { queryClient, Wrapper: function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  } };
}

describe('useLogout', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
    mockedClearAll.mockReset();
    mockedGetRefreshToken.mockReset();
    mockedReplace.mockReset();
  });

  it('chama POST /auth/logout com o refresh_token quando existente', async () => {
    // Arrange
    mockedGetRefreshToken.mockResolvedValue('refresh-token-atual');
    mockedApiRequest.mockResolvedValue(undefined);
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });

    // Act
    act(() => {
      result.current.mutate();
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiRequest).toHaveBeenCalledWith('/auth/logout', {
      method: 'POST',
      body: { refresh_token: 'refresh-token-atual' },
    });
  });

  it('não chama a API de logout quando não há refresh_token local', async () => {
    // Arrange
    mockedGetRefreshToken.mockResolvedValue(null);
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });

    // Act
    act(() => {
      result.current.mutate();
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it('limpa a sessão local, o cache do react-query e redireciona para o login mesmo se a chamada à API falhar', async () => {
    // Arrange
    mockedGetRefreshToken.mockResolvedValue('refresh-token-atual');
    mockedApiRequest.mockRejectedValue(new Error('Falha de rede'));
    const { queryClient, Wrapper } = createWrapper();
    const clearSpy = jest.spyOn(queryClient, 'clear');
    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });

    // Act
    act(() => {
      result.current.mutate();
    });

    // Assert — onSettled roda independentemente do resultado da mutationFn
    await waitFor(() => expect(mockedClearAll).toHaveBeenCalled());
    expect(clearSpy).toHaveBeenCalled();
    expect(mockedReplace).toHaveBeenCalledWith('/(auth)/login');
  });
});
