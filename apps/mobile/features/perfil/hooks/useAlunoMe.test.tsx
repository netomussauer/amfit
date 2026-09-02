import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useAlunoMe, ALUNO_ME_QUERY_KEY } from './useAlunoMe';
import { apiRequest } from '@/shared/lib/api-client';
import { makeAlunoResponse } from '../__fixtures__/perfil.fixtures';

jest.mock('@/shared/lib/api-client', () => ({
  apiRequest: jest.fn(),
}));

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return { queryClient, Wrapper: function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  } };
}

describe('useAlunoMe', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('busca o endpoint /alunos/me e expõe os dados retornados', async () => {
    // Arrange
    const aluno = makeAlunoResponse();
    mockedApiRequest.mockResolvedValue(aluno);
    const { Wrapper } = createWrapper();

    // Act
    const { result } = renderHook(() => useAlunoMe(), { wrapper: Wrapper });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiRequest).toHaveBeenCalledWith('/alunos/me');
    expect(result.current.data).toEqual(aluno);
  });

  it('usa a query key ALUNO_ME_QUERY_KEY para armazenar o resultado no cache', async () => {
    // Arrange
    const aluno = makeAlunoResponse();
    mockedApiRequest.mockResolvedValue(aluno);
    const { queryClient, Wrapper } = createWrapper();

    // Act
    const { result } = renderHook(() => useAlunoMe(), { wrapper: Wrapper });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(ALUNO_ME_QUERY_KEY)).toEqual(aluno);
  });

  it('expõe o estado de erro quando o service falha', async () => {
    // Arrange
    const error = new Error('Falha ao buscar aluno');
    mockedApiRequest.mockRejectedValue(error);
    const { Wrapper } = createWrapper();

    // Act
    const { result } = renderHook(() => useAlunoMe(), { wrapper: Wrapper });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
  });
});
