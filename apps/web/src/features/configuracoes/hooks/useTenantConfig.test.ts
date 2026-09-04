import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantConfigResponse } from '@amfit/shared';
import { QueryWrapper } from '@/shared/test-utils/setup-query';
import { tenantService } from '../services/tenant.service';
import { useTenantConfig } from './useTenantConfig';

vi.mock('../services/tenant.service', () => ({
  tenantService: {
    getMinhaConfig: vi.fn(),
  },
}));

const mockedGetConfig = vi.mocked(tenantService.getMinhaConfig);

const configFixture: TenantConfigResponse = {
  cor_primaria: 'f97316',
  cor_secundaria: 'ea580c',
};

describe('useTenantConfig', () => {
  beforeEach(() => {
    mockedGetConfig.mockReset();
  });

  it('busca a config de branding do personal autenticado', async () => {
    mockedGetConfig.mockResolvedValueOnce(configFixture);

    const { result } = renderHook(() => useTenantConfig(), { wrapper: QueryWrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(configFixture);
  });
});
