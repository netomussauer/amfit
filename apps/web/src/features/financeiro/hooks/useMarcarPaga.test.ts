import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { MensalidadeResponse } from '@amfit/shared';
import { createTestQueryClient } from '@/shared/test-utils/setup-query';
import { financeiroService } from '../services/financeiro.service';
import { financeiroKeys } from './query-keys';
import { useMarcarPaga } from './useMarcarPaga';

vi.mock('../services/financeiro.service', () => ({
  financeiroService: { marcarPaga: vi.fn() },
}));

const mockedMarcarPaga = vi.mocked(financeiroService.marcarPaga);

const mensalidadeFixture: MensalidadeResponse = {
  id: 'mensalidade-1',
  plano_id: 'plano-1',
  aluno_id: 'aluno-1',
  competencia_ano: 2026,
  competencia_mes: 9,
  data_vencimento: '2026-09-10',
  valor: 200,
  status: 'PAGA',
  criado_em: '2026-09-01T10:00:00Z',
  atualizado_em: '2026-09-01T10:00:00Z',
};

describe('useMarcarPaga', () => {
  it('marca a mensalidade como paga e invalida mensalidades + dashboard', async () => {
    mockedMarcarPaga.mockResolvedValueOnce(mensalidadeFixture);
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useMarcarPaga(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    const payload = { forma_pagamento: 'PIX' as const };
    result.current.mutate({ mensalidadeId: 'mensalidade-1', payload });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedMarcarPaga).toHaveBeenCalledWith('mensalidade-1', payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: financeiroKeys.mensalidades() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: financeiroKeys.dashboard() });
  });
});
