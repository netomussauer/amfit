import { encerrarBrandingAutenticado } from './branding-session';
import { clearConfigCache } from './theme-cache';
import { requestThemeRefresh } from './theme-refresh';

jest.mock('./theme-cache', () => ({
  clearConfigCache: jest.fn(),
}));

jest.mock('./theme-refresh', () => ({
  requestThemeRefresh: jest.fn(),
}));

const mockedClear = clearConfigCache as jest.MockedFunction<typeof clearConfigCache>;
const mockedRefresh = requestThemeRefresh as jest.MockedFunction<typeof requestThemeRefresh>;

describe('encerrarBrandingAutenticado', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('apaga o cache da config autenticada e só depois pede o recálculo do tema', async () => {
    const ordem: string[] = [];
    mockedClear.mockImplementation(async () => {
      ordem.push('limpa-cache');
    });
    mockedRefresh.mockImplementation(() => {
      ordem.push('refresh');
    });

    await encerrarBrandingAutenticado();

    expect(ordem).toEqual(['limpa-cache', 'refresh']);
  });
});
