import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { financeiroService } from '../services/financeiro.service';
import { useMensalidades } from './useMensalidades';

vi.mock('../services/financeiro.service', () => ({
  financeiroService: { listMensalidades: vi.fn() },
}));

const mockedListMensalidades = vi.mocked(financeiroService.listMensalidades);

describe('useMensalidades', () => {
  it('busca as mensalidades com os parametros informados', async () => {
    const responseFixture = { data: [], pagination: { total: 0, page: 1, per_page: 20 } };
    mockedListMensalidades.mockResolvedValueOnce(responseFixture);

    const params = { page: 1, perPage: 20, status: 'ATRASADA' };
    const { result } = renderHook(() => useMensalidades(params), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedListMensalidades).toHaveBeenCalledWith(params);
    expect(result.current.data).toEqual(responseFixture);
  });
});
