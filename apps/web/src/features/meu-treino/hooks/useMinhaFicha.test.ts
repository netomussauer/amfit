import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FichaResponse } from '@amfit/shared';
import { createTestQueryClient } from '@/shared/test-utils/setup-query';
import { treinoService } from '../services/treino.service';
import { useMinhaFicha } from './useMinhaFicha';

vi.mock('../services/treino.service', () => ({
  treinoService: { getTreinoHoje: vi.fn(), getMinhaFicha: vi.fn() },
}));

const mockedGetMinhaFicha = vi.mocked(treinoService.getMinhaFicha);

const fichaPayload: FichaResponse = {
  id: '22222222-2222-2222-2222-222222222222',
  nome: 'Ficha ativa',
  aluno_id: '33333333-3333-3333-3333-333333333333',
  vigencia_inicio: '2026-01-01',
  vigencia_fim: null,
  ativa: true,
  treinos: [],
};

function makeAxiosError(status: number) {
  const error = new AxiosError('erro');
  error.response = {
    status,
    data: {},
    statusText: '',
    headers: {},
    // @ts-expect-error -- config nao e relevante para este teste
    config: {},
  };
  return error;
}

describe('useMinhaFicha', () => {
  beforeEach(() => {
    mockedGetMinhaFicha.mockReset();
  });

  it('retorna a ficha ativa quando existe', async () => {
    mockedGetMinhaFicha.mockResolvedValueOnce(fichaPayload);
    const client = createTestQueryClient();

    const { result } = renderHook(() => useMinhaFicha(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(fichaPayload);
  });

  it('expõe erro 404 (sem ficha ativa) como AxiosError', async () => {
    mockedGetMinhaFicha.mockRejectedValueOnce(makeAxiosError(404));
    const client = createTestQueryClient();

    const { result } = renderHook(() => useMinhaFicha(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.response?.status).toBe(404);
  });
});
