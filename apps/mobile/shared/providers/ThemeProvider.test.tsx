import { Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import { getAccessToken } from '@/shared/lib/auth';
import { getConfigCache, setConfigCache } from '@/features/tenant/lib/theme-cache';
import { requestThemeRefresh } from '@/features/tenant/lib/theme-refresh';
import { tenantService } from '@/features/tenant/services/tenant.service';
import { ThemeProvider } from './ThemeProvider';

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
}));

jest.mock('@/features/tenant/services/tenant.service', () => ({
  tenantService: { getMinhaConfig: jest.fn() },
}));

const mockedGetAccessToken = getAccessToken as jest.MockedFunction<typeof getAccessToken>;
const mockedGetConfigCache = getConfigCache as jest.MockedFunction<typeof getConfigCache>;
const mockedSetConfigCache = setConfigCache as jest.MockedFunction<typeof setConfigCache>;
const mockedGetMinhaConfig = tenantService.getMinhaConfig as jest.MockedFunction<
  typeof tenantService.getMinhaConfig
>;

function primaryColorOf(): string {
  const el = screen.getByTestId('theme-provider-root');
  const styleArray = Array.isArray(el.props.style) ? el.props.style : [el.props.style];
  const varsStyle = styleArray.find((s: Record<string, unknown>) => '--color-primary' in s);
  return varsStyle?.['--color-primary'];
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mantém o tema default quando o usuário não está autenticado', async () => {
    mockedGetAccessToken.mockResolvedValue(null);

    render(
      <ThemeProvider>
        <Text>conteúdo</Text>
      </ThemeProvider>,
    );

    await waitFor(() => expect(mockedGetAccessToken).toHaveBeenCalled());

    expect(primaryColorOf()).toBe('#f97316');
    expect(mockedGetConfigCache).not.toHaveBeenCalled();
    expect(mockedGetMinhaConfig).not.toHaveBeenCalled();
  });

  it('aplica o cache imediatamente e não revalida quando ainda está fresco', async () => {
    mockedGetAccessToken.mockResolvedValue('token-valido');
    mockedGetConfigCache.mockResolvedValue({
      config: { cor_primaria: '112233', cor_secundaria: '445566' },
      stale: false,
    });

    render(
      <ThemeProvider>
        <Text>conteúdo</Text>
      </ThemeProvider>,
    );

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

    render(
      <ThemeProvider>
        <Text>conteúdo</Text>
      </ThemeProvider>,
    );

    // O cache stale é aplicado imediatamente (evita flash pro default) e
    // depois sobrescrito pela revalidação em background — como os mocks
    // resolvem quase instantaneamente aqui, só o estado final (revalidado)
    // é observável de forma não-flaky; a ordem em si é garantida pelo
    // código (setTheme do cache roda antes do await do fetch).
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

    render(
      <ThemeProvider>
        <Text>conteúdo</Text>
      </ThemeProvider>,
    );

    await waitFor(() => expect(primaryColorOf()).toBe('#778899'));
  });

  it('mantém o default sem lançar quando não há cache e a busca falha', async () => {
    mockedGetAccessToken.mockResolvedValue('token-valido');
    mockedGetConfigCache.mockResolvedValue(null);
    mockedGetMinhaConfig.mockRejectedValue(new Error('network down'));

    render(
      <ThemeProvider>
        <Text>conteúdo</Text>
      </ThemeProvider>,
    );

    await waitFor(() => expect(mockedGetMinhaConfig).toHaveBeenCalled());
    expect(primaryColorOf()).toBe('#f97316');
  });

  it('busca a config de novo quando requestThemeRefresh é chamado (ex.: após login)', async () => {
    mockedGetAccessToken.mockResolvedValue('token-valido');
    mockedGetConfigCache.mockResolvedValue(null);
    mockedGetMinhaConfig.mockResolvedValue({
      cor_primaria: '778899',
      cor_secundaria: 'aabbcc',
    });

    render(
      <ThemeProvider>
        <Text>conteúdo</Text>
      </ThemeProvider>,
    );

    await waitFor(() => expect(mockedGetMinhaConfig).toHaveBeenCalledTimes(1));

    mockedGetMinhaConfig.mockResolvedValue({
      cor_primaria: 'ff00ff',
      cor_secundaria: '00ff00',
    });
    requestThemeRefresh();

    await waitFor(() => expect(mockedGetMinhaConfig).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(primaryColorOf()).toBe('#ff00ff'));
  });
});
