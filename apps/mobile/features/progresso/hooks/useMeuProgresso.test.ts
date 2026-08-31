import { renderHook } from '@testing-library/react-native';
import { useMeuProgresso } from './useMeuProgresso';

// Os testes que exercitam o fluxo de dados (sucesso/erro/params) do hook
// vivem em `useMeuProgresso.test.tsx`, pois precisam de um wrapper JSX
// com QueryClientProvider. Este arquivo cobre o contrato de que o hook
// depende de um QueryClient no contexto — não pode ser usado sem um.
jest.mock('../services/progresso.service', () => ({
  progressoService: {
    getMeuProgresso: jest.fn(),
  },
}));

describe('useMeuProgresso (sem QueryClientProvider)', () => {
  it('lança erro ao ser usado fora de um QueryClientProvider', () => {
    expect(() => {
      renderHook(() => useMeuProgresso('exercicio-1'));
    }).toThrow(/no queryclient set/i);
  });
});
