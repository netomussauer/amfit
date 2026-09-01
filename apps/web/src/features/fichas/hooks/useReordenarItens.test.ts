import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { FichaResponse, TreinoResponse } from '@amfit/shared';
import { createTestQueryClient } from '@/shared/test-utils/setup-query';
import { fichaService } from '../services/ficha.service';
import { fichaKeys } from './query-keys';
import { useReordenarItens } from './useReordenarItens';

vi.mock('../services/ficha.service', () => ({
  fichaService: {
    reordenarItens: vi.fn(),
  },
}));

const mockedReordenarItens = vi.mocked(fichaService.reordenarItens);

function makeExercicio(id: string) {
  return {
    id,
    nome: `Exercício ${id}`,
    grupo_muscular: { id: 'grupo-1', nome: 'Peito' },
    is_global: true,
  };
}

const item1 = {
  id: 'item-1',
  ordem: 0,
  exercicio: makeExercicio('ex-1'),
  series: 3,
  repeticoes: '8-12',
};
const item2 = {
  id: 'item-2',
  ordem: 1,
  exercicio: makeExercicio('ex-2'),
  series: 3,
  repeticoes: '8-12',
};

const treinoFixture: TreinoResponse = {
  id: 'treino-1',
  letra: 'A',
  ordem: 0,
  itens: [item1, item2],
};

const fichaFixture: FichaResponse = {
  id: 'ficha-1',
  nome: 'Hipertrofia — Maio/2026',
  aluno_id: 'aluno-1',
  vigencia_inicio: '2026-05-01',
  ativa: true,
  treinos: [treinoFixture],
};

// `gcTime: 0` (config de teste) descarta dados sem observer ativo quase
// imediatamente — mesma ressalva documentada em useAtualizarConta.test.ts.
// Por isso verificamos as escritas no cache via spy em `setQueryData` em vez
// de ler `getQueryData` depois que o efeito ja rodou.
function renderWithSeededCache() {
  const client = createTestQueryClient();
  client.setQueryData(fichaKeys.detail('ficha-1'), fichaFixture);
  const setQueryDataSpy = vi.spyOn(client, 'setQueryData');

  const { result } = renderHook(() => useReordenarItens(), {
    wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
  });

  return { client, result, setQueryDataSpy };
}

describe('useReordenarItens', () => {
  beforeEach(() => {
    mockedReordenarItens.mockReset();
  });

  it('aplica optimistic update reordenando os itens do treino no cache antes da resposta do service', async () => {
    // Nunca resolve nesta asserção — queremos capturar o estado logo apos
    // onMutate, antes do onSettled invalidar a query.
    mockedReordenarItens.mockImplementation(() => new Promise(() => {}));
    const { result, setQueryDataSpy } = renderWithSeededCache();

    result.current.mutate({ fichaId: 'ficha-1', treinoId: 'treino-1', ids: ['item-2', 'item-1'] });

    await waitFor(() => expect(setQueryDataSpy).toHaveBeenCalled());

    expect(setQueryDataSpy).toHaveBeenLastCalledWith(fichaKeys.detail('ficha-1'), {
      ...fichaFixture,
      treinos: [
        {
          ...treinoFixture,
          itens: [
            { ...item2, ordem: 0 },
            { ...item1, ordem: 1 },
          ],
        },
      ],
    });
  });

  it('chama o service com treinoId e a lista de ids reordenada, e invalida o detalhe da ficha ao final', async () => {
    mockedReordenarItens.mockResolvedValueOnce(treinoFixture);
    const { client, result } = renderWithSeededCache();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    result.current.mutate({ fichaId: 'ficha-1', treinoId: 'treino-1', ids: ['item-2', 'item-1'] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedReordenarItens).toHaveBeenCalledWith('treino-1', { ids: ['item-2', 'item-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: fichaKeys.detail('ficha-1') });
  });

  it('reverte para o estado anterior do cache quando a mutation falha', async () => {
    const error = new AxiosError('Erro interno');
    error.response = {
      status: 500,
      data: {},
      statusText: 'Internal Server Error',
      headers: {},
      // @ts-expect-error -- config nao e relevante para este teste
      config: {},
    };
    mockedReordenarItens.mockRejectedValueOnce(error);
    const { result, setQueryDataSpy } = renderWithSeededCache();

    result.current.mutate({ fichaId: 'ficha-1', treinoId: 'treino-1', ids: ['item-2', 'item-1'] });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(setQueryDataSpy).toHaveBeenLastCalledWith(fichaKeys.detail('ficha-1'), fichaFixture);
  });
});
