import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantConfigResponse } from '@amfit/shared';
import { createTestQueryClient } from '@/shared/test-utils/setup-query';
import { tenantService } from '../services/tenant.service';
import { tenantKeys } from './query-keys';
import { useAtualizarTenantConfig } from './useAtualizarTenantConfig';

const { mockedRefresh } = vi.hoisted(() => ({ mockedRefresh: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockedRefresh }),
}));

vi.mock('../services/tenant.service', () => ({
  tenantService: {
    atualizarConfig: vi.fn(),
  },
}));

const mockedAtualizar = vi.mocked(tenantService.atualizarConfig);

const configFixture: TenantConfigResponse = {
  cor_primaria: '112233',
  cor_secundaria: 'ea580c',
};

describe('useAtualizarTenantConfig', () => {
  beforeEach(() => {
    mockedAtualizar.mockReset();
    mockedRefresh.mockReset();
  });

  it('atualiza a config, popula o cache e força o layout raiz a re-renderizar', async () => {
    mockedAtualizar.mockResolvedValueOnce(configFixture);
    const client = createTestQueryClient();
    const setQueryDataSpy = vi.spyOn(client, 'setQueryData');

    const { result } = renderHook(() => useAtualizarTenantConfig(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    });

    result.current.mutate({ payload: { cor_primaria: '112233' }, logo: null });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedAtualizar).toHaveBeenCalledWith({ cor_primaria: '112233' }, null);
    expect(setQueryDataSpy).toHaveBeenCalledWith(tenantKeys.me(), configFixture);
    // router.refresh() é o que faz as novas CSS vars (injetadas no <html>
    // pelo Server Component do layout raiz) aparecerem sem reload completo.
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });
});
