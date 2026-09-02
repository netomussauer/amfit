import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import type { RegistroSerieResponse, SessaoResponse } from '@amfit/shared';
import { useRegistrarSerie } from './useRegistrarSerie';
import { execucaoService } from '../services/execucao.service';
import { sessaoKeys } from './query-keys';
import {
  makeRegistroSerieResponse,
  makeSessaoResponse,
} from '../__fixtures__/execucao.fixtures';

jest.mock('../services/execucao.service', () => ({
  execucaoService: {
    registrarSerie: jest.fn(),
  },
}));

const mockedRegistrarSerie = execucaoService.registrarSerie as jest.MockedFunction<
  typeof execucaoService.registrarSerie
>;

function createWrapper(sessaoInicial?: SessaoResponse) {
  const queryClient = new QueryClient({
    defaultOptions: {
      // gcTime padrão (não 0): o cache é lido diretamente via
      // `getQueryData` sem nenhum `useSessao` observando a query — com
      // gcTime 0 a entrada seria coletada antes da asserção rodar.
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  if (sessaoInicial) {
    queryClient.setQueryData(sessaoKeys.detail(sessaoInicial.id), sessaoInicial);
  }

  const Wrapper = function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  return { queryClient, Wrapper };
}

/** Cria uma Promise controlável externamente para simular uma mutation "em voo". */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useRegistrarSerie', () => {
  beforeEach(() => {
    mockedRegistrarSerie.mockReset();
  });

  it('chama o service com o sessaoId e o corpo informados', async () => {
    // Arrange
    const sessao = makeSessaoResponse({ series: [] });
    const registro = makeRegistroSerieResponse({ concluida: true });
    mockedRegistrarSerie.mockResolvedValue(registro);
    const { Wrapper } = createWrapper(sessao);
    const { result } = renderHook(() => useRegistrarSerie(sessao.id), {
      wrapper: Wrapper,
    });

    // Act
    act(() => {
      result.current.mutate({
        item_treino_id: registro.item_treino_id,
        numero_serie: registro.numero_serie,
        concluida: true,
        carga_realizada: 80,
        repeticoes_realizadas: 10,
      });
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedRegistrarSerie).toHaveBeenCalledWith(sessao.id, {
      item_treino_id: registro.item_treino_id,
      numero_serie: registro.numero_serie,
      concluida: true,
      carga_realizada: 80,
      repeticoes_realizadas: 10,
    });
  });

  it('aplica um optimistic update no cache antes da resposta do backend', async () => {
    // Arrange — sessão sem nenhuma série registrada ainda
    const sessao = makeSessaoResponse({ series: [] });
    const { promise, resolve } = deferred<RegistroSerieResponse>();
    mockedRegistrarSerie.mockReturnValue(promise);
    const { queryClient, Wrapper } = createWrapper(sessao);
    const { result } = renderHook(() => useRegistrarSerie(sessao.id), {
      wrapper: Wrapper,
    });

    // Act
    act(() => {
      result.current.mutate({
        item_treino_id: '30000000-0000-0000-0000-000000000001',
        numero_serie: 1,
        concluida: true,
        carga_realizada: 60,
        repeticoes_realizadas: 12,
      });
    });

    // Assert — antes da resposta do backend, o cache já reflete a série otimista
    await waitFor(() => expect(result.current.isPending).toBe(true));
    const cacheOtimista = queryClient.getQueryData<SessaoResponse>(
      sessaoKeys.detail(sessao.id),
    );
    expect(cacheOtimista?.series).toHaveLength(1);
    expect(cacheOtimista?.series[0]).toMatchObject({
      item_treino_id: '30000000-0000-0000-0000-000000000001',
      numero_serie: 1,
      concluida: true,
      carga_realizada: 60,
      repeticoes_realizadas: 12,
    });

    // Cleanup — resolve a promise pendente para não vazar entre testes
    resolve(makeRegistroSerieResponse());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('substitui o registro otimista pelo retornado pelo backend após sucesso', async () => {
    // Arrange
    const sessao = makeSessaoResponse({ series: [] });
    const registro = makeRegistroSerieResponse({
      id: 'registro-real-id',
      item_treino_id: '30000000-0000-0000-0000-000000000001',
      numero_serie: 1,
      concluida: true,
      carga_realizada: 60,
      repeticoes_realizadas: 12,
    });
    mockedRegistrarSerie.mockResolvedValue(registro);
    const { queryClient, Wrapper } = createWrapper(sessao);
    const { result } = renderHook(() => useRegistrarSerie(sessao.id), {
      wrapper: Wrapper,
    });

    // Act
    act(() => {
      result.current.mutate({
        item_treino_id: registro.item_treino_id,
        numero_serie: registro.numero_serie,
        concluida: true,
        carga_realizada: 60,
        repeticoes_realizadas: 12,
      });
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cacheFinal = queryClient.getQueryData<SessaoResponse>(
      sessaoKeys.detail(sessao.id),
    );
    expect(cacheFinal?.series).toEqual([registro]);
  });

  it('reverte o cache para o estado anterior quando o service falha', async () => {
    // Arrange
    const registroExistente = makeRegistroSerieResponse({ concluida: false });
    const sessao = makeSessaoResponse({ series: [registroExistente] });
    const error = new Error('Falha ao registrar série');
    mockedRegistrarSerie.mockRejectedValue(error);
    const { queryClient, Wrapper } = createWrapper(sessao);
    const { result } = renderHook(() => useRegistrarSerie(sessao.id), {
      wrapper: Wrapper,
    });

    // Act
    act(() => {
      result.current.mutate({
        item_treino_id: registroExistente.item_treino_id,
        numero_serie: registroExistente.numero_serie,
        concluida: true,
        carga_realizada: 82.5,
        repeticoes_realizadas: 8,
      });
    });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
    const cacheRevertido = queryClient.getQueryData<SessaoResponse>(
      sessaoKeys.detail(sessao.id),
    );
    expect(cacheRevertido).toEqual(sessao);
  });
});
