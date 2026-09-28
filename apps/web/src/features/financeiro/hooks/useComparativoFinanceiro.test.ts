import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { financeiroService } from '../services/financeiro.service';
import { useComparativoFinanceiro } from './useComparativoFinanceiro';

vi.mock('../services/financeiro.service', () => ({
  financeiroService: { getComparativo: vi.fn() },
}));

const mockedGetComparativo = vi.mocked(financeiroService.getComparativo);

describe('useComparativoFinanceiro', () => {
  it('busca o comparativo financeiro com o numero de meses informado', async () => {
    const comparativoFixture = {
      data: [
        {
          ano: 2026,
          mes: 8,
          receita_paga: 800,
          total_previsto: 1000,
          valor_atrasado: 200,
          taxa_inadimplencia_pct: 20,
        },
      ],
    };
    mockedGetComparativo.mockResolvedValueOnce(comparativoFixture);

    const { result } = renderHook(() => useComparativoFinanceiro(12), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(comparativoFixture);
    expect(mockedGetComparativo).toHaveBeenCalledWith(12);
  });

  it('usa 6 meses como default quando nenhum argumento e passado', async () => {
    mockedGetComparativo.mockResolvedValueOnce({ data: [] });

    const { result } = renderHook(() => useComparativoFinanceiro(), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetComparativo).toHaveBeenCalledWith(6);
  });
});
