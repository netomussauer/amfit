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

describe('tenantService.getConfigPublica', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('busca /public/tenants/<codigo>/config e devolve os dados', async () => {
    const response = {
      cor_primaria: '112233',
      cor_secundaria: '445566',
      nome_app: 'Studio X',
      logo_url: 'https://minio.amfit.local/tenant-logos/abc',
    };
    mockedApiRequest.mockResolvedValue(response);

    const result = await tenantService.getConfigPublica('K7M2QX9P');

    expect(mockedApiRequest).toHaveBeenCalledWith('/public/tenants/K7M2QX9P/config');
    expect(result).toEqual(response);
  });

  it('lança quando a resposta não bate com o schema', async () => {
    mockedApiRequest.mockResolvedValue({ cor_primaria: 'não-hex', cor_secundaria: 'x' });

    await expect(tenantService.getConfigPublica('K7M2QX9P')).rejects.toThrow();
  });
});
