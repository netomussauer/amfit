import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessaoResponse } from '@amfit/shared';
import { createTestQueryClient } from '@/shared/test-utils/setup-query';
import { execucaoService } from '../services/execucao.service';
import { execucaoSessaoKeys } from './query-keys';
import { treinoHojeKeys } from '@/features/meu-treino/hooks/query-keys';
import { useIniciarSessao } from './useIniciarSessao';

vi.mock('../services/execucao.service', () => ({
  execucaoService: { iniciar: vi.fn() },
}));

const mockedIniciar = vi.mocked(execucaoService.iniciar);

const sessaoPayload: SessaoResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  treino_id: '22222222-2222-2222-2222-222222222222',
  data_execucao: '2026-08-31',
  status: 'EM_ANDAMENTO',
  iniciado_em: '2026-08-31T12:00:00Z',
  concluido_em: null,
  series: [],
};

describe('useIniciarSessao', () => {
  beforeEach(() => {
    mockedIniciar.mockReset();
  });

  it('inicia a sessão, popula o cache do detalhe e invalida o treino de hoje', async () => {
    mockedIniciar.mockResolvedValueOnce(sessaoPayload);
    const client = createTestQueryClient();
    const setQueryDataSpy = vi.spyOn(client, 'setQueryData');
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useIniciarSessao(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    result.current.mutate({ treino_id: sessaoPayload.treino_id });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedIniciar).toHaveBeenCalledWith(sessaoPayload.treino_id);
    expect(setQueryDataSpy).toHaveBeenCalledWith(
      execucaoSessaoKeys.detail(sessaoPayload.id),
      sessaoPayload,
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: treinoHojeKeys.hoje() });
  });
});
