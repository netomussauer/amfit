import { createElement } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantConfigResponse } from '@amfit/shared';
import { createTestQueryClient } from '@/shared/test-utils/setup-query';
import { tenantService } from '../services/tenant.service';
import { tenantKeys } from './query-keys';
import { useRegenerarCodigoTenant } from './useRegenerarCodigoTenant';

vi.mock('../services/tenant.service', () => ({
  tenantService: {
    regenerarCodigo: vi.fn(),
  },
}));

const mockedRegenerar = vi.mocked(tenantService.regenerarCodigo);

const configNova: TenantConfigResponse = {
  cor_primaria: 'f97316',
  cor_secundaria: 'ea580c',
  codigo: 'K7M2QX9P',
};

function montar() {
  const client = createTestQueryClient();
  const setSpy = vi.spyOn(client, 'setQueryData');
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  const { result } = renderHook(() => useRegenerarCodigoTenant(), {
    wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
  });
  return { result, setSpy, invalidateSpy };
}

describe('useRegenerarCodigoTenant', () => {
  beforeEach(() => {
    mockedRegenerar.mockReset();
  });

  it('grava a config nova no cache e rebusca ao terminar', async () => {
    mockedRegenerar.mockResolvedValueOnce(configNova);
    const { result, setSpy, invalidateSpy } = montar();

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setSpy).toHaveBeenCalledWith(tenantKeys.me(), configNova);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tenantKeys.me() });
  });

  it('em erro, ainda rebusca — a troca pode ter sido gravada mesmo com a resposta falhando', async () => {
    mockedRegenerar.mockRejectedValueOnce(new AxiosError('Internal Server Error'));
    const { result, setSpy, invalidateSpy } = montar();

    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(setSpy).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tenantKeys.me() });
  });
});
