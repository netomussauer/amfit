import { renderHook } from '@testing-library/react-native';
import { useConcluirSessao } from './useConcluirSessao';

// Os testes que exercitam o fluxo de dados (sucesso/erro/invalidação de cache)
// do hook vivem em `useConcluirSessao.test.tsx`, pois precisam de um wrapper
// JSX com QueryClientProvider. Este arquivo cobre o contrato de que o hook
// depende de um QueryClient no contexto — não pode ser usado sem um.
jest.mock('../services/execucao.service', () => ({
  execucaoService: {
    concluir: jest.fn(),
  },
}));

describe('useConcluirSessao (sem QueryClientProvider)', () => {
  it('lança erro ao ser usado fora de um QueryClientProvider', () => {
    expect(() => {
      renderHook(() => useConcluirSessao('sessao-1'));
    }).toThrow(/no queryclient set/i);
  });
});
