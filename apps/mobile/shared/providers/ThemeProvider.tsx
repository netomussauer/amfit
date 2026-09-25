import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { vars } from 'nativewind';
import type { TenantConfigResponse } from '@amfit/shared';
import { ApiError } from '@/shared/lib/api-client';
import { getAccessToken } from '@/shared/lib/auth';
import {
  clearPublicBranding,
  getConfigCache,
  getPublicBranding,
  setConfigCache,
  setPublicBranding,
} from '@/features/tenant/lib/theme-cache';
import { setThemeRefreshHandler } from '@/features/tenant/lib/theme-refresh';
import { tenantService } from '@/features/tenant/services/tenant.service';

// Mesmos hex que já eram o default hardcoded em tailwind.config.js antes
// deste provider existir — sem nenhuma config de branding (deslogado sem
// convite aplicado, ainda sem cache, ou fetch falhou), o app continua
// idêntico visualmente.
const defaultTheme = vars({
  '--color-primary': '#f97316',
  '--color-primary-hover': '#ea580c',
});

function themeFromConfig(config: TenantConfigResponse) {
  return vars({
    '--color-primary': `#${config.cor_primaria}`,
    '--color-primary-hover': `#${config.cor_secundaria}`,
  });
}

/** Partes do branding além das cores, que o tema (CSS vars) não cobre. */
export type Branding = {
  nomeApp: string | null;
  logoUrl: string | null;
};

const semBranding: Branding = { nomeApp: null, logoUrl: null };

const BrandingContext = createContext<Branding>(semBranding);

/** Nome do app e logo do personal ativo (autenticado ou, antes do login, o do
 * convite aplicado); `null` nos dois quando não há branding. */
export function useBranding(): Branding {
  return useContext(BrandingContext);
}

function brandingFromConfig(config: TenantConfigResponse | null): Branding {
  if (!config) return semBranding;
  const nome = config.nome_app?.trim();
  return { nomeApp: nome ? nome : null, logoUrl: config.logo_url ?? null };
}

/**
 * White Label (SDD §20.4, ADR-007) — aplica o branding do personal e
 * sobrescreve as CSS vars que `tailwind.config.js` usa pra
 * `primary`/`primary-hover`, pra toda a árvore abaixo.
 *
 * Duas fontes, por estado de sessão:
 *  - com token: a config autenticada (`/tenants/me/config`) — do personal do
 *    aluno logado, ou do próprio personal;
 *  - sem token: o branding público do convite que o aluno aplicou (deep
 *    link ou código digitado), se houver — é o que a tela de login mostra.
 *
 * Cache local (AsyncStorage, TTL 24h) nas duas: aplica instantaneamente no
 * mount, sem flash de tema default, e revalida em background quando ausente
 * ou expirado.
 *
 * Além do mount (cold start), recalcula sob demanda via
 * requestThemeRefresh(): após login (busca a config do usuário novo sem
 * aproveitar cache — pode ser de outra conta), após logout e ao aplicar um
 * código de convite.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<TenantConfigResponse | null>(null);

  useEffect(() => {
    let cancelado = false;
    // Geração da execução mais recente. carregar() pode rodar várias vezes
    // ao mesmo tempo (mount, login, logout, convite aplicado): uma execução
    // mais lenta e já superada não pode aplicar estado nem regravar cache
    // depois de uma mais nova — senão, por exemplo, um getMinhaConfig iniciado
    // antes do logout regravaria o cache que o logout acabou de limpar, e a
    // próxima conta neste aparelho veria a marca do usuário anterior.
    let geracao = 0;

    async function carregar(forcar: boolean) {
      const minha = ++geracao;
      const vigente = () => !cancelado && minha === geracao;
      const aplicar = (nova: TenantConfigResponse | null) => {
        if (vigente()) setConfig(nova);
      };

      async function carregarPublico() {
        const publico = await getPublicBranding();
        aplicar(publico?.config ?? null);
        if (!publico || !publico.stale) return; // sem convite, ou cache fresco

        try {
          const nova = await tenantService.getConfigPublica(publico.codigo);
          if (!vigente()) return;
          aplicar(nova);
          await setPublicBranding(publico.codigo, nova);
        } catch (err) {
          if (!vigente()) return;
          if (err instanceof ApiError && err.status === 404) {
            // O código deixou de valer (personal gerou outro, ou foi
            // desativado): esquece o convite em vez de mostrar uma marca
            // que não existe mais.
            await clearPublicBranding();
            aplicar(null);
            return;
          }
          // Sem rede: fica com o que já está em cache.
          console.warn('[theme] falha ao revalidar o branding público', err);
        }
      }

      async function carregarAutenticado() {
        // Após login o cache pode ser de OUTRA conta — não aplica nem confia.
        const cache = forcar ? null : await getConfigCache();
        if (cache) aplicar(cache.config);
        if (cache && !cache.stale) return; // cache fresco — não revalida agora

        try {
          const nova = await tenantService.getMinhaConfig();
          if (!vigente()) return;
          aplicar(nova);
          await setConfigCache(nova);
        } catch (err) {
          // Sem cache e sem rede: nunca quebra a UI por causa de branding.
          console.warn('[theme] falha ao buscar config de branding', err);
          // Refresh forçado (login): o que está em tela é do convite ou da
          // conta anterior — melhor o visual padrão do que a marca errada.
          if (forcar) aplicar(null);
        }
      }

      const token = await getAccessToken();
      if (!vigente()) return;
      if (token) await carregarAutenticado();
      else await carregarPublico();
    }

    void carregar(false);
    setThemeRefreshHandler(() => {
      void carregar(true);
    });

    return () => {
      cancelado = true;
      setThemeRefreshHandler(null);
    };
  }, []);

  const theme = useMemo(() => (config ? themeFromConfig(config) : defaultTheme), [config]);
  const branding = useMemo(() => brandingFromConfig(config), [config]);

  return (
    <BrandingContext.Provider value={branding}>
      <View testID="theme-provider-root" style={[{ flex: 1 }, theme]}>
        {children}
      </View>
    </BrandingContext.Provider>
  );
}
