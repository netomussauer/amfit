import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessaoResponse } from '@amfit/shared';
import { createTestQueryClient } from '@/shared/test-utils/setup-query';
import { execucaoService } from '../services/execucao.service';
import { execucaoSessaoKeys, minhasSessoesKeys } from './query-keys';
import { treinoHojeKeys } from '@/features/meu-treino/hooks/query-keys';
import { useConcluirSessao } from './useConcluirSessao';

vi.mock('../services/execucao.service', () => ({
  execucaoService: { concluir: vi.fn() },
}));

const mockedConcluir = vi.mocked(execucaoService.concluir);

const sessaoId = '11111111-1111-1111-1111-111111111111';

const sessaoConcluida: SessaoResponse = {
  id: sessaoId,
  treino_id: '22222222-2222-2222-2222-222222222222',
  data_execucao: '2026-08-31',
  status: 'CONCLUIDO',
  iniciado_em: '2026-08-31T12:00:00Z',
  concluido_em: '2026-08-31T13:00:00Z',
  series: [],
};

describe('useConcluirSessao', () => {
  beforeEach(() => {
    mockedConcluir.mockReset();
  });

  it('conclui a sessão, atualiza o cache e invalida treino-hoje e minhas-sessoes', async () => {
    mockedConcluir.mockResolvedValueOnce(sessaoConcluida);
    const client = createTestQueryClient();
    const setQueryDataSpy = vi.spyOn(client, 'setQueryData');
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useConcluirSessao(sessaoId), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedConcluir).toHaveBeenCalledWith(sessaoId);
    expect(setQueryDataSpy).toHaveBeenCalledWith(
      execucaoSessaoKeys.detail(sessaoId),
      sessaoConcluida,
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: treinoHojeKeys.hoje() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: minhasSessoesKeys.all });
  });
});
