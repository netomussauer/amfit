import { renderHook } from '@testing-library/react-native';
import { useAlunoMe } from './useAlunoMe';

// Os testes que exercitam o fluxo de dados (sucesso/erro) do hook vivem em
// `useAlunoMe.test.tsx`, pois precisam de um wrapper JSX com
// QueryClientProvider. Este arquivo cobre o contrato de que o hook depende
// de um QueryClient no contexto — não pode ser usado sem um.
jest.mock('@/shared/lib/api-client', () => ({
  apiRequest: jest.fn(),
}));

describe('useAlunoMe (sem QueryClientProvider)', () => {
  it('lança erro ao ser usado fora de um QueryClientProvider', () => {
    expect(() => {
      renderHook(() => useAlunoMe());
    }).toThrow(/no queryclient set/i);
  });
});
