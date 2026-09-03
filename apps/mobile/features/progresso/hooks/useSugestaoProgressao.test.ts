import { renderHook } from '@testing-library/react-native';
import { useSugestaoProgressao } from './useSugestaoProgressao';

// Os testes que exercitam o fluxo de dados (sucesso/erro) do hook vivem em
// `useSugestaoProgressao.test.tsx`, pois precisam de um wrapper JSX com
// QueryClientProvider. Este arquivo cobre o contrato de que o hook depende
// de um QueryClient no contexto — não pode ser usado sem um.
jest.mock('../services/progresso.service', () => ({
  progressoService: {
    getMinhaSugestao: jest.fn(),
  },
}));

describe('useSugestaoProgressao (sem QueryClientProvider)', () => {
  it('lança erro ao ser usado fora de um QueryClientProvider', () => {
    expect(() => {
      renderHook(() => useSugestaoProgressao('exercicio-1'));
    }).toThrow(/no queryclient set/i);
  });
});
