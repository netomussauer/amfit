import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TreinoHojeResponse } from '@amfit/shared';
import { createTestQueryClient } from '@/shared/test-utils/setup-query';
import { treinoService } from '../services/treino.service';
import { useTreinoHoje } from './useTreinoHoje';

vi.mock('../services/treino.service', () => ({
  treinoService: { getTreinoHoje: vi.fn(), getMinhaFicha: vi.fn() },
}));

const mockedGetTreinoHoje = vi.mocked(treinoService.getTreinoHoje);

const treinoHojePayload: TreinoHojeResponse = {
  treino: {
    id: '11111111-1111-1111-1111-111111111111',
    letra: 'A',
    nome: null,
    ordem: 0,
    itens: [],
  },
  sessao_hoje_id: null,
};

describe('useTreinoHoje', () => {
  beforeEach(() => {
    mockedGetTreinoHoje.mockReset();
  });

  it('retorna o treino de hoje quando existe', async () => {
    mockedGetTreinoHoje.mockResolvedValueOnce(treinoHojePayload);
    const client = createTestQueryClient();

    const { result } = renderHook(() => useTreinoHoje(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(treinoHojePayload);
  });

  it('retorna null quando não há treino hoje', async () => {
    mockedGetTreinoHoje.mockResolvedValueOnce(null);
    const client = createTestQueryClient();

    const { result } = renderHook(() => useTreinoHoje(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
