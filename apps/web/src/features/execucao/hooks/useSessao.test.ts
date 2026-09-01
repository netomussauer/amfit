import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessaoResponse } from '@amfit/shared';
import { createTestQueryClient } from '@/shared/test-utils/setup-query';
import { execucaoService } from '../services/execucao.service';
import { useSessao } from './useSessao';

vi.mock('../services/execucao.service', () => ({
  execucaoService: { buscar: vi.fn() },
}));

const mockedBuscar = vi.mocked(execucaoService.buscar);

const sessaoPayload: SessaoResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  treino_id: '22222222-2222-2222-2222-222222222222',
  data_execucao: '2026-08-31',
  status: 'EM_ANDAMENTO',
  iniciado_em: '2026-08-31T12:00:00Z',
  concluido_em: null,
  series: [],
};

describe('useSessao', () => {
  beforeEach(() => {
    mockedBuscar.mockReset();
  });

  it('busca a sessão pelo id', async () => {
    mockedBuscar.mockResolvedValueOnce(sessaoPayload);
    const client = createTestQueryClient();

    const { result } = renderHook(() => useSessao(sessaoPayload.id), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedBuscar).toHaveBeenCalledWith(sessaoPayload.id);
    expect(result.current.data).toEqual(sessaoPayload);
  });

  it('não busca quando o id é undefined', () => {
    const client = createTestQueryClient();

    const { result } = renderHook(() => useSessao(undefined), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedBuscar).not.toHaveBeenCalled();
  });
});
