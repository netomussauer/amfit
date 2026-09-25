import { Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/shared/lib/api-client';
import { getAccessToken } from '@/shared/lib/auth';
import {
  clearPublicBranding,
  getConfigCache,
  getPublicBranding,
  setConfigCache,
  setPublicBranding,
} from '@/features/tenant/lib/theme-cache';
import { requestThemeRefresh } from '@/features/tenant/lib/theme-refresh';
import { tenantService } from '@/features/tenant/services/tenant.service';
import { ThemeProvider, useBranding } from './ThemeProvider';

// `vars()` de verdade (NativeWind v4) faz uma transformação em build-time
// via plugin do Babel/Metro que não roda no ambiente de teste — o objeto
// que ela devolve em Jest não é o mesmo shape do app real, e inspecionar
// esse detalhe de implementação deixaria o teste acoplado a internals da
// lib. Mock devolve o argumento como está: testamos que o ThemeProvider
// monta e aplica o objeto de vars certo, não como a NativeWind processa
// esse objeto por baixo dos panos.
jest.mock('nativewind', () => ({
  vars: jest.fn((v: Record<string, string>) => v),
}));

jest.mock('@/shared/lib/auth', () => ({
  getAccessToken: jest.fn(),
}));

jest.mock('@/features/tenant/lib/theme-cache', () => ({
  getConfigCache: jest.fn(),
  setConfigCache: jest.fn(),
  getPublicBranding: jest.fn(),
  setPublicBranding: jest.fn(),
  clearPublicBranding: jest.fn(),
}));

jest.mock('@/features/tenant/services/tenant.service', () => ({
  tenantService: { getMinhaConfig: jest.fn(), getConfigPublica: jest.fn() },
}));

const mockedGetAccessToken = getAccessToken as jest.MockedFunction<typeof getAccessToken>;
const mockedGetConfigCache = getConfigCache as jest.MockedFunction<typeof getConfigCache>;
const mockedSetConfigCache = setConfigCache as jest.MockedFunction<typeof setConfigCache>;
const mockedGetPublicBranding = getPublicBranding as jest.MockedFunction<typeof getPublicBranding>;
const mockedSetPublicBranding = setPublicBranding as jest.MockedFunction<typeof setPublicBranding>;
const mockedClearPublicBranding = clearPublicBranding as jest.MockedFunction<
  typeof clearPublicBranding
>;
const mockedGetMinhaConfig = tenantService.getMinhaConfig as jest.MockedFunction<
  typeof tenantService.getMinhaConfig
>;
const mockedGetConfigPublica = tenantService.getConfigPublica as jest.MockedFunction<
  typeof tenantService.getConfigPublica
>;

function primaryColorOf(): string {
  const el = screen.getByTestId('theme-provider-root');
  const styleArray = Array.isArray(el.props.style) ? el.props.style : [el.props.style];
  const varsStyle = styleArray.find((s: Record<string, unknown>) => '--color-primary' in s);
  return varsStyle?.['--color-primary'];
}

function Marca() {
  const { nomeApp, logoUrl } = useBranding();
  return <Text testID="marca">{`${nomeApp ?? '-'}|${logoUrl ?? '-'}`}</Text>;
}

async function renderProvider() {
  await render(
    <ThemeProvider>
      <Marca />
    </ThemeProvider>,
  );
}

// Este arquivo mostrou timeouts esporádicos no ambiente de CI/dev (o
// primeiro render assíncrono é sabidamente mais lento, e sob carga chega a
// passar de 15s) — não é um teste específico travando, é o ambiente sob
// carga. Sobe o timeout padrão pro arquivo inteiro em vez de remendar
// teste por teste.
jest.setTimeout(20000);

describe('ThemeProvider — sessão autenticada', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetPublicBranding.mockResolvedValue(null);
  });

  it('aplica o cache imediatamente e não revalida quando ainda está fresco', async () => {
    mockedGetAccessToken.mockResolvedValue('token-valido');
    mockedGetConfigCache.mockResolvedValue({
      config: { cor_primaria: '112233', cor_secundaria: '445566' },
      stale: false,
    });

    await renderProvider();

    await waitFor(() => expect(primaryColorOf()).toBe('#112233'));
    expect(mockedGetMinhaConfig).not.toHaveBeenCalled();
  });

  it('aplica o cache stale imediatamente e revalida em background', async () => {
    mockedGetAccessToken.mockResolvedValue('token-valido');
    mockedGetConfigCache.mockResolvedValue({
      config: { cor_primaria: '112233', cor_secundaria: '445566' },
      stale: true,
    });
    mockedGetMinhaConfig.mockResolvedValue({
      cor_primaria: '778899',
      cor_secundaria: 'aabbcc',
    });

    await renderProvider();

    // O cache stale é aplicado imediatamente (evita flash pro default) e
    // depois sobrescrito pela revalidação em background — como os mocks
    // resolvem quase instantaneamente aqui, só o estado final (revalidado)
    // é observável de forma não-flaky; a ordem em si é garantida pelo
    // código (o aplicar do cache roda antes do await do fetch).
    await waitFor(() => expect(primaryColorOf()).toBe('#778899'));
    expect(mockedGetMinhaConfig).toHaveBeenCalledTimes(1);
    expect(mockedSetConfigCache).toHaveBeenCalledWith({
      cor_primaria: '778899',
      cor_secundaria: 'aabbcc',
    });
  });

  it('busca a config quando não há nenhum cache', async () => {
    mockedGetAccessToken.mockResolvedValue('token-valido');
    mockedGetConfigCache.mockResolvedValue(null);
    mockedGetMinhaConfig.mockResolvedValue({
      cor_primaria: '778899',
      cor_secundaria: 'aabbcc',
    });

    await renderProvider();

    await waitFor(() => expect(primaryColorOf()).toBe('#778899'));
  });

  it('mantém o default sem lançar quando não há cache e a busca falha', async () => {
    mockedGetAccessToken.mockResolvedValue('token-valido');
    mockedGetConfigCache.mockResolvedValue(null);
    mockedGetMinhaConfig.mockRejectedValue(new Error('network down'));

    await renderProvider();

    await waitFor(() => expect(mockedGetMinhaConfig).toHaveBeenCalled());
    expect(primaryColorOf()).toBe('#f97316');
  });

  it('com token, a config autenticada vale e o branding público nem é consultado', async () => {
    mockedGetAccessToken.mockResolvedValue('token-valido');
    mockedGetConfigCache.mockResolvedValue({
      config: { cor_primaria: '112233', cor_secundaria: '445566', nome_app: 'Studio Auth' },
      stale: false,
    });
    mockedGetPublicBranding.mockResolvedValue({
      codigo: 'K7M2QX9P',
      config: { cor_primaria: 'aaaaaa', cor_secundaria: 'bbbbbb', nome_app: 'Studio Convite' },
      stale: false,
    });

    await renderProvider();

    await waitFor(() => expect(primaryColorOf()).toBe('#112233'));
    expect(screen.getByTestId('marca').props.children).toBe('Studio Auth|-');
    expect(mockedGetPublicBranding).not.toHaveBeenCalled();
  });

  it('busca a config de novo, sem usar o cache, quando requestThemeRefresh é chamado (ex.: após login)', async () => {
    mockedGetAccessToken.mockResolvedValue('token-valido');
    mockedGetConfigCache.mockResolvedValue(null);
    mockedGetMinhaConfig.mockResolvedValue({
      cor_primaria: '778899',
      cor_secundaria: 'aabbcc',
    });

    await renderProvider();
    await waitFor(() => expect(mockedGetMinhaConfig).toHaveBeenCalledTimes(1));
    expect(mockedGetConfigCache).toHaveBeenCalledTimes(1);

    mockedGetMinhaConfig.mockResolvedValue({
      cor_primaria: 'ff00ff',
      cor_secundaria: '00ff00',
    });
    requestThemeRefresh();

    await waitFor(() => expect(mockedGetMinhaConfig).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(primaryColorOf()).toBe('#ff00ff'));
    // O cache pode ser de outra conta: o refresh pós-login nem o consulta.
    expect(mockedGetConfigCache).toHaveBeenCalledTimes(1);
  });
});

describe('ThemeProvider — antes do login (branding público)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetAccessToken.mockResolvedValue(null);
  });

  it('mantém o tema default sem token e sem convite aplicado', async () => {
    mockedGetPublicBranding.mockResolvedValue(null);

    await renderProvider();

    await waitFor(() => expect(mockedGetPublicBranding).toHaveBeenCalled());
    expect(primaryColorOf()).toBe('#f97316');
    expect(screen.getByTestId('marca').props.children).toBe('-|-');
    expect(mockedGetConfigCache).not.toHaveBeenCalled();
    expect(mockedGetMinhaConfig).not.toHaveBeenCalled();
  });

  it('aplica cores, nome e logo do convite guardado, sem revalidar quando fresco', async () => {
    mockedGetPublicBranding.mockResolvedValue({
      codigo: 'K7M2QX9P',
      config: {
        cor_primaria: '112233',
        cor_secundaria: '445566',
        nome_app: 'Studio X',
        logo_url: 'https://minio.amfit.local/tenant-logos/abc',
      },
      stale: false,
    });

    await renderProvider();

    await waitFor(() => expect(primaryColorOf()).toBe('#112233'));
    expect(screen.getByTestId('marca').props.children).toBe(
      'Studio X|https://minio.amfit.local/tenant-logos/abc',
    );
    expect(mockedGetConfigPublica).not.toHaveBeenCalled();
  });

  it('revalida em background o convite vencido e regrava o cache', async () => {
    mockedGetPublicBranding.mockResolvedValue({
      codigo: 'K7M2QX9P',
      config: { cor_primaria: '112233', cor_secundaria: '445566' },
      stale: true,
    });
    const nova = { cor_primaria: '778899', cor_secundaria: 'aabbcc', nome_app: 'Novo Nome' };
    mockedGetConfigPublica.mockResolvedValue(nova);

    await renderProvider();

    await waitFor(() => expect(primaryColorOf()).toBe('#778899'));
    expect(mockedGetConfigPublica).toHaveBeenCalledWith('K7M2QX9P');
    expect(mockedSetPublicBranding).toHaveBeenCalledWith('K7M2QX9P', nova);
  });

  it('esquece o convite quando o código deixou de valer (404)', async () => {
    mockedGetPublicBranding.mockResolvedValue({
      codigo: 'K7M2QX9P',
      config: { cor_primaria: '112233', cor_secundaria: '445566' },
      stale: true,
    });
    mockedGetConfigPublica.mockRejectedValue(new ApiError(404, 'não encontrado'));

    await renderProvider();

    await waitFor(() => expect(mockedClearPublicBranding).toHaveBeenCalled());
    await waitFor(() => expect(primaryColorOf()).toBe('#f97316'));
    expect(screen.getByTestId('marca').props.children).toBe('-|-');
  });

  it('mantém a marca em cache quando a revalidação falha por rede', async () => {
    mockedGetPublicBranding.mockResolvedValue({
      codigo: 'K7M2QX9P',
      config: { cor_primaria: '112233', cor_secundaria: '445566' },
      stale: true,
    });
    mockedGetConfigPublica.mockRejectedValue(new Error('network down'));

    await renderProvider();

    await waitFor(() => expect(mockedGetConfigPublica).toHaveBeenCalled());
    expect(primaryColorOf()).toBe('#112233');
    expect(mockedClearPublicBranding).not.toHaveBeenCalled();
  });

  it('volta pro branding público quando requestThemeRefresh roda depois do logout', async () => {
    mockedGetAccessToken.mockResolvedValueOnce('token-valido');
    mockedGetConfigCache.mockResolvedValue({
      config: { cor_primaria: '112233', cor_secundaria: '445566' },
      stale: false,
    });
    mockedGetPublicBranding.mockResolvedValue({
      codigo: 'K7M2QX9P',
      config: { cor_primaria: 'aaaaaa', cor_secundaria: 'bbbbbb' },
      stale: false,
    });

    await renderProvider();
    await waitFor(() => expect(primaryColorOf()).toBe('#112233'));

    // logout: sem token a partir daqui (mockResolvedValue(null) do beforeEach)
    requestThemeRefresh();

    await waitFor(() => expect(primaryColorOf()).toBe('#aaaaaa'));
  });
});

describe('ThemeProvider — execuções sobrepostas e falhas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetPublicBranding.mockResolvedValue(null);
  });

  it('uma execução lenta já superada não sobrescreve estado nem regrava o cache (logout durante um getMinhaConfig)', async () => {
    // Cold start autenticado: o cache está stale, então o getMinhaConfig
    // fica pendurado (lento) enquanto o usuário faz logout.
    mockedGetAccessToken.mockResolvedValueOnce('token-valido');
    mockedGetConfigCache.mockResolvedValue({
      config: { cor_primaria: '112233', cor_secundaria: '445566' },
      stale: true,
    });
    let resolverLento: (c: { cor_primaria: string; cor_secundaria: string }) => void = () => undefined;
    mockedGetMinhaConfig.mockReturnValue(
      new Promise((resolve) => {
        resolverLento = resolve;
      }),
    );

    await renderProvider();
    await waitFor(() => expect(primaryColorOf()).toBe('#112233'));

    // Logout: sem token; o branding público (fresco) passa a valer.
    mockedGetAccessToken.mockResolvedValue(null);
    mockedGetPublicBranding.mockResolvedValue({
      codigo: 'K7M2QX9P',
      config: { cor_primaria: 'aaaaaa', cor_secundaria: 'bbbbbb' },
      stale: false,
    });
    requestThemeRefresh();
    await waitFor(() => expect(primaryColorOf()).toBe('#aaaaaa'));

    // A busca antiga (do usuário que saiu) só agora responde.
    resolverLento({ cor_primaria: 'ff0000', cor_secundaria: '00ff00' });
    await new Promise((r) => setTimeout(r, 50));

    expect(primaryColorOf()).toBe('#aaaaaa');
    expect(mockedSetConfigCache).not.toHaveBeenCalled();
  });

  it('após o login, se a busca da config falha, cai no visual padrão (não fica a marca do convite/conta anterior)', async () => {
    mockedGetAccessToken.mockResolvedValueOnce(null);
    mockedGetPublicBranding.mockResolvedValue({
      codigo: 'K7M2QX9P',
      config: { cor_primaria: 'aaaaaa', cor_secundaria: 'bbbbbb' },
      stale: false,
    });

    await renderProvider();
    await waitFor(() => expect(primaryColorOf()).toBe('#aaaaaa'));

    // Login: agora há token, mas o getMinhaConfig falha.
    mockedGetAccessToken.mockResolvedValue('token-novo');
    mockedGetMinhaConfig.mockRejectedValue(new Error('network down'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    requestThemeRefresh();

    await waitFor(() => expect(primaryColorOf()).toBe('#f97316'));
    warn.mockRestore();
  });
});
