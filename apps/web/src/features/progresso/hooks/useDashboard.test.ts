import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardResponse } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { progressoService } from '../services/progresso.service';
import { useDashboard } from './useDashboard';

vi.mock('../services/progresso.service', () => ({
  progressoService: {
    getDashboard: vi.fn(),
  },
}));

const mockedGetDashboard = vi.mocked(progressoService.getDashboard);

const dashboardFixture: DashboardResponse = {
  alunos_ativos: 10,
  fichas_ativas: 6,
  sessoes_ultimos_7_dias: 15,
  sessoes_ultimos_30_dias: 60,
  alunos_sem_sessao_7_dias: 2,
};

describe('useDashboard', () => {
  beforeEach(() => {
    mockedGetDashboard.mockReset();
  });

  it('retorna os dados do dashboard apos o fetch ter sucesso', async () => {
    mockedGetDashboard.mockResolvedValueOnce(dashboardFixture);

    const { result } = renderHook(() => useDashboard(), { wrapper: QueryWrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(dashboardFixture);
    expect(mockedGetDashboard).toHaveBeenCalledTimes(1);
  });

  it('expoe isError quando o service rejeita', async () => {
    mockedGetDashboard.mockRejectedValueOnce(new Error('falha de rede'));

    const { result } = renderHook(() => useDashboard(), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.data).toBeUndefined();
  });
});
