import AsyncStorage from '@react-native-async-storage/async-storage';
import { TenantConfigResponseSchema, type TenantConfigResponse } from '@amfit/shared';

const STORAGE_KEY = 'tenant_config';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h — SDD §20.4

type CachedConfig = {
  config: TenantConfigResponse;
  cachedAt: number;
};

export type ConfigCacheEntry = {
  config: TenantConfigResponse;
  /** true quando o cache passou do TTL de 24h — ainda serve pra aplicar
   * instantaneamente (evita flash de tema no cold start), mas o caller
   * deve revalidar em background. */
  stale: boolean;
};

/** Lê o cache local. Nunca lança — cache corrompido/ausente vira `null`,
 * tratado como "sem cache" pelo caller. */
export async function getConfigCache(): Promise<ConfigCacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedConfig;
    return {
      config: parsed.config,
      stale: Date.now() - parsed.cachedAt > TTL_MS,
    };
  } catch {
    return null;
  }
}

export async function setConfigCache(config: TenantConfigResponse): Promise<void> {
  const payload: CachedConfig = { config, cachedAt: Date.now() };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

/** Apaga o cache da config autenticada. Nunca lança: uma falha ao apagar
 * não pode impedir o logout. */
export async function clearConfigCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[theme-cache] falha ao apagar a config em cache', err);
  }
}

// ── Branding público (antes do login) ──────────────────────────────────────
//
// Cache separado do da config autenticada: guarda a marca do personal cujo
// código de convite o aluno aplicou (deep link ou digitado) — é o que a tela
// de login mostra. Sobrevive ao logout de propósito (o aparelho "lembra" o
// studio do aluno); a config autenticada, não.

const PUBLIC_STORAGE_KEY = 'tenant_public_config';

type CachedPublicBranding = {
  codigo: string;
  config: TenantConfigResponse;
  cachedAt: number;
};

export type PublicBrandingEntry = {
  codigo: string;
  config: TenantConfigResponse;
  /** Passou do TTL de 24h — serve pra aplicar já, mas deve revalidar. */
  stale: boolean;
};

/** Nunca lança — ausente/corrompido vira `null`. */
export async function getPublicBranding(): Promise<PublicBrandingEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(PUBLIC_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedPublicBranding;
    // Valida o formato: um cachedAt ausente/inválido viraria NaN e a entrada
    // nunca ficaria "stale" (nunca revalidaria); uma config malformada
    // quebraria quem a consome.
    const config = TenantConfigResponseSchema.safeParse(parsed.config);
    if (
      typeof parsed.codigo !== 'string' ||
      !Number.isFinite(parsed.cachedAt) ||
      !config.success
    ) {
      return null;
    }
    return {
      codigo: parsed.codigo,
      config: config.data,
      stale: Date.now() - parsed.cachedAt > TTL_MS,
    };
  } catch {
    return null;
  }
}

export async function setPublicBranding(
  codigo: string,
  config: TenantConfigResponse,
): Promise<void> {
  const payload: CachedPublicBranding = { codigo, config, cachedAt: Date.now() };
  await AsyncStorage.setItem(PUBLIC_STORAGE_KEY, JSON.stringify(payload));
}

/** Nunca lança. */
export async function clearPublicBranding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PUBLIC_STORAGE_KEY);
  } catch (err) {
    console.warn('[theme-cache] falha ao apagar o branding público em cache', err);
  }
}
