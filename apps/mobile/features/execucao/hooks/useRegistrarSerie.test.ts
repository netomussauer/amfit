import { renderHook } from '@testing-library/react-native';
import { useRegistrarSerie } from './useRegistrarSerie';

// Os testes que exercitam o fluxo de dados (optimistic update/erro/sucesso) do
// hook vivem em `useRegistrarSerie.test.tsx`, pois precisam de um wrapper JSX
// com QueryClientProvider. Este arquivo cobre o contrato de que o hook
// depende de um QueryClient no contexto — não pode ser usado sem um.
jest.mock('../services/execucao.service', () => ({
  execucaoService: {
    registrarSerie: jest.fn(),
  },
}));

describe('useRegistrarSerie (sem QueryClientProvider)', () => {
  it('lança erro ao ser usado fora de um QueryClientProvider', () => {
    expect(() => {
      renderHook(() => useRegistrarSerie('sessao-1'));
    }).toThrow(/no queryclient set/i);
  });
});
