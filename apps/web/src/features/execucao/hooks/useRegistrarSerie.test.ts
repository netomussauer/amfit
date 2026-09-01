import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegistrarSerieRequest, RegistroSerieResponse, SessaoResponse } from '@amfit/shared';
import { createTestQueryClient } from '@/shared/test-utils/setup-query';
import { execucaoService } from '../services/execucao.service';
import { execucaoSessaoKeys } from './query-keys';
import { useRegistrarSerie } from './useRegistrarSerie';

vi.mock('../services/execucao.service', () => ({
  execucaoService: { registrarSerie: vi.fn() },
}));

const mockedRegistrarSerie = vi.mocked(execucaoService.registrarSerie);

const sessaoId = '11111111-1111-1111-1111-111111111111';
const itemTreinoId = '22222222-2222-2222-2222-222222222222';

const sessaoInicial: SessaoResponse = {
  id: sessaoId,
  treino_id: '33333333-3333-3333-3333-333333333333',
  data_execucao: '2026-08-31',
  status: 'EM_ANDAMENTO',
  iniciado_em: '2026-08-31T12:00:00Z',
  concluido_em: null,
  series: [],
};

const body: RegistrarSerieRequest = {
  item_treino_id: itemTreinoId,
  numero_serie: 1,
  concluida: true,
  carga_realizada: 20,
  repeticoes_realizadas: 12,
};

// `gcTime: 0` (config de teste) descarta dados sem observer ativo quase
// imediatamente — mesma ressalva documentada em useReordenarItens.test.ts.
// Por isso verificamos as escritas no cache via spy em `setQueryData` em vez
// de ler `getQueryData` depois que o efeito ja rodou.
function renderWithSeededCache() {
  const client = createTestQueryClient();
  client.setQueryData(execucaoSessaoKeys.detail(sessaoId), sessaoInicial);
  const setQueryDataSpy = vi.spyOn(client, 'setQueryData');

  const { result } = renderHook(() => useRegistrarSerie(sessaoId), {
    wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
  });

  return { client, result, setQueryDataSpy };
}

describe('useRegistrarSerie', () => {
  beforeEach(() => {
    mockedRegistrarSerie.mockReset();
  });

  it('aplica optimistic update adicionando a série ao cache antes da resposta do backend', async () => {
    // Nunca resolve nesta asserção — queremos capturar o estado logo apos
    // onMutate, antes do onSuccess trocar pelo registro real.
    mockedRegistrarSerie.mockImplementation(() => new Promise(() => {}));
    const { result, setQueryDataSpy } = renderWithSeededCache();

    result.current.mutate(body);

    await waitFor(() => expect(setQueryDataSpy).toHaveBeenCalled());

    const [, updater] = setQueryDataSpy.mock.calls[0] as [unknown, SessaoResponse];
    expect(updater.series).toHaveLength(1);
    expect(updater.series[0]).toMatchObject({
      item_treino_id: itemTreinoId,
      numero_serie: 1,
      concluida: true,
      carga_realizada: 20,
      repeticoes_realizadas: 12,
    });
  });

  it('substitui o registro otimista pelo retornado pelo backend em caso de sucesso', async () => {
    const registroReal: RegistroSerieResponse = {
      id: '44444444-4444-4444-4444-444444444444',
      ...body,
      executado_em: '2026-08-31T12:05:00Z',
    };
    mockedRegistrarSerie.mockResolvedValueOnce(registroReal);
    const { result, setQueryDataSpy } = renderWithSeededCache();

    result.current.mutate(body);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(setQueryDataSpy).toHaveBeenLastCalledWith(execucaoSessaoKeys.detail(sessaoId), {
      ...sessaoInicial,
      series: [registroReal],
    });
  });

  it('reverte para o estado anterior do cache quando a mutation falha', async () => {
    mockedRegistrarSerie.mockRejectedValueOnce(new Error('falha de rede'));
    const { result, setQueryDataSpy } = renderWithSeededCache();

    result.current.mutate(body);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(setQueryDataSpy).toHaveBeenLastCalledWith(
      execucaoSessaoKeys.detail(sessaoId),
      sessaoInicial,
    );
  });
});
