import { renderHook } from '@testing-library/react-native';
import { useIniciarSessao } from './useIniciarSessao';

// Os testes que exercitam o fluxo de dados (sucesso/erro/efeitos no cache) do
// hook vivem em `useIniciarSessao.test.tsx`, pois precisam de um wrapper JSX
// com QueryClientProvider. Este arquivo cobre o contrato de que o hook
// depende de um QueryClient no contexto — não pode ser usado sem um.
jest.mock('../services/execucao.service', () => ({
  execucaoService: {
    iniciar: jest.fn(),
  },
}));

describe('useIniciarSessao (sem QueryClientProvider)', () => {
  it('lança erro ao ser usado fora de um QueryClientProvider', () => {
    expect(() => {
      renderHook(() => useIniciarSessao());
    }).toThrow(/no queryclient set/i);
  });
});
