import { apiRequest } from '@/shared/lib/api-client';
import { tenantService } from './tenant.service';

jest.mock('@/shared/lib/api-client', () => ({
  apiRequest: jest.fn(),
}));

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('tenantService.getMinhaConfig', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('busca /tenants/me/config e devolve os dados quando a resposta é válida', async () => {
    const response = { cor_primaria: 'f97316', cor_secundaria: 'ea580c' };
    mockedApiRequest.mockResolvedValue(response);

    const result = await tenantService.getMinhaConfig();

    expect(mockedApiRequest).toHaveBeenCalledWith('/tenants/me/config');
    expect(result).toEqual(response);
  });

  it('lança quando a resposta não bate com o schema', async () => {
    mockedApiRequest.mockResolvedValue({ cor_primaria: 'não-hex' });

    await expect(tenantService.getMinhaConfig()).rejects.toThrow();
  });
});
