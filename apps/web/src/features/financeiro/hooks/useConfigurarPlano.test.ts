import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { PlanoResponse } from '@amfit/shared';
import { createTestQueryClient } from '@/shared/test-utils/setup-query';
import { financeiroService } from '../services/financeiro.service';
import { financeiroKeys } from './query-keys';
import { useConfigurarPlano } from './useConfigurarPlano';

vi.mock('../services/financeiro.service', () => ({
  financeiroService: { configurarPlano: vi.fn() },
}));

const mockedConfigurarPlano = vi.mocked(financeiroService.configurarPlano);

const planoFixture: PlanoResponse = {
  id: 'plano-1',
  aluno_id: 'aluno-1',
  valor_mensal: 200,
  dia_vencimento: 10,
  vigencia_inicio: '2026-01-01',
  status: 'ATIVO',
  criado_em: '2026-01-01T10:00:00Z',
  atualizado_em: '2026-01-01T10:00:00Z',
};

describe('useConfigurarPlano', () => {
  it('cria o plano e grava o resultado no cache de plano do aluno', async () => {
    mockedConfigurarPlano.mockResolvedValueOnce(planoFixture);
    const client = createTestQueryClient();
    const setQueryDataSpy = vi.spyOn(client, 'setQueryData');

    const { result } = renderHook(() => useConfigurarPlano(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    const payload = { valor_mensal: 200, dia_vencimento: 10 };
    result.current.mutate({ alunoId: 'aluno-1', payload });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedConfigurarPlano).toHaveBeenCalledWith('aluno-1', payload);
    expect(setQueryDataSpy).toHaveBeenCalledWith(financeiroKeys.plano('aluno-1'), planoFixture);
  });
});
