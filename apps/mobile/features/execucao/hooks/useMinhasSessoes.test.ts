import { renderHook } from '@testing-library/react-native';
import { useMinhasSessoes } from './useMinhasSessoes';

// Os testes que exercitam o fluxo de dados (paginação/sucesso/erro) do hook
// vivem em `useMinhasSessoes.test.tsx`, pois precisam de um wrapper JSX com
// QueryClientProvider. Este arquivo cobre o contrato de que o hook depende de
// um QueryClient no contexto — não pode ser usado sem um.
jest.mock('../services/execucao.service', () => ({
  execucaoService: {
    listarMinhasSessoes: jest.fn(),
  },
}));

describe('useMinhasSessoes (sem QueryClientProvider)', () => {
  it('lança erro ao ser usado fora de um QueryClientProvider', () => {
    expect(() => {
      renderHook(() => useMinhasSessoes());
    }).toThrow(/no queryclient set/i);
  });
});
