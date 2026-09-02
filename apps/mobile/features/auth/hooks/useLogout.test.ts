import { renderHook } from '@testing-library/react-native';
import { useLogout } from './useLogout';

// Os testes que exercitam o fluxo de dados (logout remoto/limpeza local/
// redirecionamento) do hook vivem em `useLogout.test.tsx`, pois precisam de
// um wrapper JSX com QueryClientProvider. Este arquivo cobre o contrato de
// que o hook depende de um QueryClient no contexto — não pode ser usado sem
// um (o hook também depende do router do expo-router, mockado abaixo).
jest.mock('@/shared/lib/api-client', () => ({
  apiRequest: jest.fn(),
}));

jest.mock('@/shared/lib/auth', () => ({
  clearAll: jest.fn(),
  getRefreshToken: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

describe('useLogout (sem QueryClientProvider)', () => {
  it('lança erro ao ser usado fora de um QueryClientProvider', () => {
    expect(() => {
      renderHook(() => useLogout());
    }).toThrow(/no queryclient set/i);
  });
});
