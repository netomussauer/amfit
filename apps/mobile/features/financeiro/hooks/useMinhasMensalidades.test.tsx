import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useMinhasMensalidades } from './useMinhasMensalidades';
import { financeiroService } from '../services/financeiro.service';

jest.mock('../services/financeiro.service', () => ({
  financeiroService: { getMinhasMensalidades: jest.fn() },
}));

const mockedGetMinhasMensalidades =
  financeiroService.getMinhasMensalidades as jest.MockedFunction<
    typeof financeiroService.getMinhasMensalidades
  >;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const responseFixture = {
  data: [],
  pagination: { total: 0, page: 1, per_page: 12 },
};

describe('useMinhasMensalidades', () => {
  beforeEach(() => {
    mockedGetMinhasMensalidades.mockReset();
  });

  it('busca as mensalidades e repassa os params ao service', async () => {
    mockedGetMinhasMensalidades.mockResolvedValue(responseFixture);

    const params = { per_page: 12 };
    const { result } = renderHook(() => useMinhasMensalidades(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetMinhasMensalidades).toHaveBeenCalledWith(params);
    expect(result.current.data).toEqual(responseFixture);
  });

  it('busca sem params quando nenhum é informado', async () => {
    mockedGetMinhasMensalidades.mockResolvedValue(responseFixture);

    const { result } = renderHook(() => useMinhasMensalidades(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetMinhasMensalidades).toHaveBeenCalledWith(undefined);
  });
});
