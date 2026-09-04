import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useLogin } from './useLogin';
import { apiRequest } from '@/shared/lib/api-client';
import { setAccessToken, setRefreshToken } from '@/shared/lib/auth';
import { registrarPushTokenExpo } from '@/features/notificacoes';
import { makeAuthResponse, makeLoginRequest } from '../__fixtures__/auth.fixtures';

jest.mock('@/shared/lib/api-client', () => ({
  apiRequest: jest.fn(),
}));

jest.mock('@/shared/lib/auth', () => ({
  setAccessToken: jest.fn(),
  setRefreshToken: jest.fn(),
}));

jest.mock('@/features/notificacoes', () => ({
  registrarPushTokenExpo: jest.fn(),
}));

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;
const mockedSetAccessToken = setAccessToken as jest.MockedFunction<typeof setAccessToken>;
const mockedSetRefreshToken = setRefreshToken as jest.MockedFunction<
  typeof setRefreshToken
>;
const mockedRegistrarPushTokenExpo = registrarPushTokenExpo as jest.MockedFunction<
  typeof registrarPushTokenExpo
>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useLogin', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
    mockedSetAccessToken.mockReset();
    mockedSetRefreshToken.mockReset();
    mockedRegistrarPushTokenExpo.mockReset();
  });

  it('chama POST /auth/login com as credenciais informadas', async () => {
    // Arrange
    const credenciais = makeLoginRequest();
    mockedApiRequest.mockResolvedValue(makeAuthResponse());
    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    // Act
    act(() => {
      result.current.mutate(credenciais);
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiRequest).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: credenciais,
    });
  });

  it('persiste o access_token e o refresh_token após login bem-sucedido', async () => {
    // Arrange
    const authResponse = makeAuthResponse({
      access_token: 'novo-access-token',
      refresh_token: 'novo-refresh-token',
    });
    mockedApiRequest.mockResolvedValue(authResponse);
    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    // Act
    act(() => {
      result.current.mutate(makeLoginRequest());
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedSetAccessToken).toHaveBeenCalledWith('novo-access-token');
    expect(mockedSetRefreshToken).toHaveBeenCalledWith('novo-refresh-token');
  });

  it('registra o push token do device após login bem-sucedido', async () => {
    // Arrange
    mockedApiRequest.mockResolvedValue(makeAuthResponse());
    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    // Act
    act(() => {
      result.current.mutate(makeLoginRequest());
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedRegistrarPushTokenExpo).toHaveBeenCalledTimes(1);
  });

  it('expõe o estado de erro quando a API rejeita as credenciais', async () => {
    // Arrange
    const error = new Error('Credenciais inválidas');
    mockedApiRequest.mockRejectedValue(error);
    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    // Act
    act(() => {
      result.current.mutate(makeLoginRequest());
    });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
    expect(mockedSetAccessToken).not.toHaveBeenCalled();
    expect(mockedRegistrarPushTokenExpo).not.toHaveBeenCalled();
  });
});
