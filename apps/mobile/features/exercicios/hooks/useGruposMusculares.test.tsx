import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useGruposMusculares } from './useGruposMusculares';
import { exercicioService } from '../services/exercicio.service';
import { makeGrupoMuscular } from '../__fixtures__/exercicio.fixtures';

jest.mock('../services/exercicio.service', () => ({
  exercicioService: {
    listGrupos: jest.fn(),
  },
}));

const mockedListGrupos = exercicioService.listGrupos as jest.MockedFunction<
  typeof exercicioService.listGrupos
>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useGruposMusculares', () => {
  beforeEach(() => {
    mockedListGrupos.mockReset();
  });

  it('busca os grupos musculares e expõe os dados retornados', async () => {
    // Arrange
    const grupos = [makeGrupoMuscular(), makeGrupoMuscular({ id: 'grupo-2', nome: 'Costas' })];
    mockedListGrupos.mockResolvedValue(grupos);

    // Act
    const { result } = renderHook(() => useGruposMusculares(), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(grupos);
    expect(mockedListGrupos).toHaveBeenCalledTimes(1);
  });

  it('expõe o estado de erro quando o service falha', async () => {
    // Arrange
    const error = new Error('Falha de rede');
    mockedListGrupos.mockRejectedValue(error);

    // Act
    const { result } = renderHook(() => useGruposMusculares(), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
  });
});
