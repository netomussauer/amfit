import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useMeuPlano } from './useMeuPlano';
import { financeiroService } from '../services/financeiro.service';
import { ApiError } from '@/shared/lib/api-client';

jest.mock('../services/financeiro.service', () => ({
  financeiroService: { getMeuPlano: jest.fn() },
}));

const mockedGetMeuPlano = financeiroService.getMeuPlano as jest.MockedFunction<
  typeof financeiroService.getMeuPlano
>;

function createWrapper() {
  const queryClient = new QueryClient({
    // retryDelay: 0 — sem isso, o backoff padrão do TanStack Query (1s no
    // primeiro retry) estoura o timeout default do waitFor no teste que
    // verifica o retry em erro não-404.
    defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const planoFixture = {
  id: 'plano-1',
  aluno_id: 'aluno-1',
  valor_mensal: 200,
  dia_vencimento: 10,
  vigencia_inicio: '2026-01-01',
  status: 'ATIVO' as const,
  criado_em: '2026-01-01T10:00:00Z',
  atualizado_em: '2026-01-01T10:00:00Z',
};

describe('useMeuPlano', () => {
  beforeEach(() => {
    mockedGetMeuPlano.mockReset();
  });

  it('busca o plano e expõe os dados retornados', async () => {
    mockedGetMeuPlano.mockResolvedValue(planoFixture);

    const { result } = renderHook(() => useMeuPlano(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(planoFixture);
  });

  it('não retenta quando o erro é 404 (aluno sem plano configurado)', async () => {
    mockedGetMeuPlano.mockRejectedValue(new ApiError(404, 'not found'));

    const { result } = renderHook(() => useMeuPlano(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockedGetMeuPlano).toHaveBeenCalledTimes(1);
  });

  it('retenta uma vez quando o erro não é 404', async () => {
    mockedGetMeuPlano.mockRejectedValue(new ApiError(500, 'boom'));

    const { result } = renderHook(() => useMeuPlano(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockedGetMeuPlano).toHaveBeenCalledTimes(2);
  });
});
