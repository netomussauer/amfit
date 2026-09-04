import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { vars } from 'nativewind';
import type { TenantConfigResponse } from '@amfit/shared';
import { getAccessToken } from '@/shared/lib/auth';
import { getConfigCache, setConfigCache } from '@/features/tenant/lib/theme-cache';
import { setThemeRefreshHandler } from '@/features/tenant/lib/theme-refresh';
import { tenantService } from '@/features/tenant/services/tenant.service';

// Mesmos hex que já eram o default hardcoded em tailwind.config.js antes
// deste provider existir — sem nenhuma config de branding (deslogado,
// ainda sem cache, ou fetch falhou), o app continua idêntico visualmente.
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

/**
 * White Label (SDD §20.4) — lê a config de branding (cores) do personal do
 * aluno logado (ou do próprio personal) e sobrescreve as CSS vars que
 * `tailwind.config.js` usa pra `primary`/`primary-hover`, aplicando pra
 * toda a árvore de componentes abaixo.
 *
 * Cache local (AsyncStorage, TTL 24h): aplica instantaneamente do cache no
 * mount — evita flash de tema default enquanto a rede responde — e
 * revalida em background quando o cache está ausente ou expirado.
 *
 * Busca no mount (cold start) e também sob demanda via
 * requestThemeRefresh() — chamada por useLogin após um login bem-sucedido,
 * pro tema do personal aparecer sem precisar reabrir o app (achado de
 * code-review: sem isso, o primeiro login numa instalação nova só via a
 * marca certa depois de matar e reabrir o app).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState(defaultTheme);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      const token = await getAccessToken();
      if (!token) return; // deslogado — fica no default

      const cache = await getConfigCache();
      if (cache && !cancelado) {
        setTheme(themeFromConfig(cache.config));
      }
      if (cache && !cache.stale) return; // cache fresco — não revalida agora

      try {
        const config = await tenantService.getMinhaConfig();
        if (!cancelado) {
          setTheme(themeFromConfig(config));
        }
        await setConfigCache(config);
      } catch (err) {
        // Sem cache e sem rede: fica no defaultTheme (nunca quebra a UI
        // por causa de branding).
        console.warn('[theme] falha ao buscar config de branding', err);
      }
    }

    void carregar();
    setThemeRefreshHandler(() => {
      void carregar();
    });

    return () => {
      cancelado = true;
      setThemeRefreshHandler(null);
    };
  }, []);

  return (
    <View testID="theme-provider-root" style={[{ flex: 1 }, theme]}>
      {children}
    </View>
  );
}
