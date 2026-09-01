import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessaoListResponse } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { meuHistoricoService } from '../services/meu-historico.service';
import { useMinhasSessoes } from './useMinhasSessoes';

vi.mock('../services/meu-historico.service', () => ({
  meuHistoricoService: {
    listar: vi.fn(),
  },
}));

const mockedListar = vi.mocked(meuHistoricoService.listar);

const listFixture: SessaoListResponse = {
  data: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      treino_id: '22222222-2222-2222-2222-222222222222',
      treino_letra: 'A',
      treino_nome: 'Treino de peito',
      data_execucao: '2026-01-10',
      status: 'CONCLUIDO',
      iniciado_em: '2026-01-10T10:00:00Z',
      concluido_em: '2026-01-10T11:00:00Z',
      total_series: 12,
      series_concluidas: 12,
    },
  ],
  pagination: { total: 1, page: 1, per_page: 20 },
};

describe('useMinhasSessoes', () => {
  beforeEach(() => {
    mockedListar.mockReset();
  });

  it('busca minhas sessoes repassando page e perPage', async () => {
    mockedListar.mockResolvedValueOnce(listFixture);

    const params = { page: 1, perPage: 20 };
    const { result } = renderHook(() => useMinhasSessoes(params), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedListar).toHaveBeenCalledWith(params);
    expect(result.current.data).toEqual(listFixture);
  });

  it('expoe isError quando o service rejeita', async () => {
    mockedListar.mockRejectedValueOnce(new Error('falha de rede'));

    const { result } = renderHook(() => useMinhasSessoes({ page: 1, perPage: 20 }), {
      wrapper: QueryWrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
