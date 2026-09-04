import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { financeiroService } from '../services/financeiro.service';
import { useDashboardFinanceiro } from './useDashboardFinanceiro';

vi.mock('../services/financeiro.service', () => ({
  financeiroService: { getDashboard: vi.fn() },
}));

const mockedGetDashboard = vi.mocked(financeiroService.getDashboard);

describe('useDashboardFinanceiro', () => {
  it('busca o dashboard financeiro', async () => {
    const dashboardFixture = {
      mensalidades_pendentes: { qtd: 1, valor: 200 },
      mensalidades_atrasadas: { qtd: 0, valor: 0 },
      receita_mes_atual: 400,
      inadimplentes: [],
    };
    mockedGetDashboard.mockResolvedValueOnce(dashboardFixture);

    const { result } = renderHook(() => useDashboardFinanceiro(), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(dashboardFixture);
  });
});
