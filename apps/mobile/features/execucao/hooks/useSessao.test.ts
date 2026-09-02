import { renderHook } from '@testing-library/react-native';
import { useSessao } from './useSessao';

// Os testes que exercitam o fluxo de dados (habilitação/sucesso/erro) do hook
// vivem em `useSessao.test.tsx`, pois precisam de um wrapper JSX com
// QueryClientProvider. Este arquivo cobre o contrato de que o hook depende de
// um QueryClient no contexto — não pode ser usado sem um.
jest.mock('../services/execucao.service', () => ({
  execucaoService: {
    buscar: jest.fn(),
  },
}));

describe('useSessao (sem QueryClientProvider)', () => {
  it('lança erro ao ser usado fora de um QueryClientProvider', () => {
    expect(() => {
      renderHook(() => useSessao('sessao-1'));
    }).toThrow(/no queryclient set/i);
  });
});
