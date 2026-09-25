import { act, renderHook } from '@testing-library/react-native';
import { ApiError, NetworkError } from '@/shared/lib/api-client';
import { tenantService } from '../services/tenant.service';
import { setPublicBranding } from '../lib/theme-cache';
import { requestThemeRefresh } from '../lib/theme-refresh';
import { useAplicarCodigoTenant } from './useAplicarCodigoTenant';

const mockedReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockedReplace }),
}));

jest.mock('../services/tenant.service', () => ({
  tenantService: { getConfigPublica: jest.fn() },
}));

jest.mock('../lib/theme-cache', () => ({
  setPublicBranding: jest.fn(),
}));

jest.mock('../lib/theme-refresh', () => ({
  requestThemeRefresh: jest.fn(),
}));

const mockedGetConfigPublica = tenantService.getConfigPublica as jest.MockedFunction<
  typeof tenantService.getConfigPublica
>;
const mockedSetPublicBranding = setPublicBranding as jest.MockedFunction<typeof setPublicBranding>;
const mockedRefresh = requestThemeRefresh as jest.MockedFunction<typeof requestThemeRefresh>;

const config = { cor_primaria: '112233', cor_secundaria: '445566', nome_app: 'Studio X' };

async function aplicar(entrada: string) {
  const { result } = await renderHook(() => useAplicarCodigoTenant());
  let ok = false;
  await act(async () => {
    ok = await result.current.aplicar(entrada);
  });
  return { result, ok };
}

describe('useAplicarCodigoTenant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('busca a config, guarda o convite, pede o recálculo do tema e vai pro login', async () => {
    mockedGetConfigPublica.mockResolvedValue(config);

    const { ok, result } = await aplicar('K7M2QX9P');

    expect(ok).toBe(true);
    expect(mockedGetConfigPublica).toHaveBeenCalledWith('K7M2QX9P');
    expect(mockedSetPublicBranding).toHaveBeenCalledWith('K7M2QX9P', config);
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
    expect(mockedReplace).toHaveBeenCalledWith('/(auth)/login');
    expect(result.current.erro).toBeNull();
    expect(result.current.carregando).toBe(false);
  });

  it('normaliza o que foi digitado (minúsculas e espaços) antes de buscar', async () => {
    mockedGetConfigPublica.mockResolvedValue(config);

    const { ok } = await aplicar('  k7m2 qx9p ');

    expect(ok).toBe(true);
    expect(mockedGetConfigPublica).toHaveBeenCalledWith('K7M2QX9P');
  });

  it('rejeita código mal formado sem chamar a API', async () => {
    for (const entrada of ['', 'abc', 'K7M2QX0P', 'K7M2QX9PA']) {
      const { ok, result } = await aplicar(entrada);

      expect(ok).toBe(false);
      expect(result.current.erro).toMatch(/código inválido/i);
    }
    expect(mockedGetConfigPublica).not.toHaveBeenCalled();
    expect(mockedReplace).not.toHaveBeenCalled();
  });

  it('código inexistente (404): mensagem própria, sem guardar nem navegar', async () => {
    mockedGetConfigPublica.mockRejectedValue(new ApiError(404, 'não encontrado'));

    const { ok, result } = await aplicar('ZZZZZZZZ');

    expect(ok).toBe(false);
    expect(result.current.erro).toMatch(/código não encontrado/i);
    expect(mockedSetPublicBranding).not.toHaveBeenCalled();
    expect(mockedReplace).not.toHaveBeenCalled();
  });

  it('sem conexão: pede pra verificar a internet', async () => {
    mockedGetConfigPublica.mockRejectedValue(new NetworkError());

    const { ok, result } = await aplicar('K7M2QX9P');

    expect(ok).toBe(false);
    expect(result.current.erro).toMatch(/sem conexão/i);
  });

  it('limite de requisições (429): pede pra aguardar', async () => {
    mockedGetConfigPublica.mockRejectedValue(new ApiError(429, 'muitas requisições'));

    const { result } = await aplicar('K7M2QX9P');

    expect(result.current.erro).toMatch(/muitas tentativas/i);
  });

  it('falha ao gravar o convite no aparelho: mensagem própria, sem navegar', async () => {
    mockedGetConfigPublica.mockResolvedValue(config);
    mockedSetPublicBranding.mockRejectedValueOnce(new Error('quota'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { ok, result } = await aplicar('K7M2QX9P');

    expect(ok).toBe(false);
    expect(result.current.erro).toMatch(/salvar o convite neste aparelho/i);
    expect(mockedReplace).not.toHaveBeenCalled();
    expect(mockedRefresh).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('erro inesperado: mensagem genérica', async () => {
    mockedGetConfigPublica.mockRejectedValue(new Error('boom'));

    const { result } = await aplicar('K7M2QX9P');

    expect(result.current.erro).toMatch(/não foi possível validar/i);
  });

  it('limparErro zera a mensagem', async () => {
    const { result } = await aplicar('abc');
    expect(result.current.erro).not.toBeNull();

    await act(async () => {
      result.current.limparErro();
    });

    expect(result.current.erro).toBeNull();
  });
});
