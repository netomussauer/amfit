import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useSugestaoProgressao } from './useSugestaoProgressao';
import { progressoService } from '../services/progresso.service';
import { makeSugestaoProgressaoResponse } from '../__fixtures__/progresso.fixtures';

jest.mock('../services/progresso.service', () => ({
  progressoService: {
    getMinhaSugestao: jest.fn(),
  },
}));

const mockedGetMinhaSugestao =
  progressoService.getMinhaSugestao as jest.MockedFunction<
    typeof progressoService.getMinhaSugestao
  >;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useSugestaoProgressao', () => {
  beforeEach(() => {
    mockedGetMinhaSugestao.mockReset();
  });

  it('não dispara a query quando exercicioId é undefined', () => {
    const { result } = renderHook(() => useSugestaoProgressao(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(mockedGetMinhaSugestao).not.toHaveBeenCalled();
  });

  it('busca a sugestão quando exercicioId é informado e expõe os dados retornados', async () => {
    const exercicioId = '33333333-3333-3333-3333-333333333333';
    const response = makeSugestaoProgressaoResponse({ exercicio_id: exercicioId });
    mockedGetMinhaSugestao.mockResolvedValue(response);

    const { result } = renderHook(() => useSugestaoProgressao(exercicioId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(response);
    expect(mockedGetMinhaSugestao).toHaveBeenCalledWith(exercicioId);
  });

  it('expõe o estado de erro quando o service falha', async () => {
    const exercicioId = '33333333-3333-3333-3333-333333333333';
    const error = new Error('Falha de rede');
    mockedGetMinhaSugestao.mockRejectedValue(error);

    const { result } = renderHook(() => useSugestaoProgressao(exercicioId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
  });
});
