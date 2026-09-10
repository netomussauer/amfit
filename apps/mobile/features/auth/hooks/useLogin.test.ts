import { renderHook } from '@testing-library/react-native';
import { useLogin } from './useLogin';

// Os testes que exercitam o fluxo de dados (sucesso/persistência de
// tokens/erro) do hook vivem em `useLogin.test.tsx`, pois precisam de um
// wrapper JSX com QueryClientProvider. Este arquivo cobre o contrato de que
// o hook depende de um QueryClient no contexto — não pode ser usado sem um.
jest.mock('@/shared/lib/api-client', () => ({
  apiRequest: jest.fn(),
}));

jest.mock('@/shared/lib/auth', () => ({
  setAccessToken: jest.fn(),
  setRefreshToken: jest.fn(),
}));

describe('useLogin (sem QueryClientProvider)', () => {
  it('lança erro ao ser usado fora de um QueryClientProvider', async () => {
    await expect(renderHook(() => useLogin())).rejects.toThrow(/no queryclient set/i);
  });
});
