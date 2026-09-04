import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TenantConfigResponse } from '@amfit/shared';

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
