import { clearConfigCache } from './theme-cache';
import { requestThemeRefresh } from './theme-refresh';

/**
 * Encerra o branding da sessão autenticada: apaga o cache da config do
 * personal do usuário que saiu (senão o próximo a logar neste aparelho veria
 * a marca dele por até 24h) e pede pro ThemeProvider recalcular — sem token,
 * ele volta pro branding público (ou pro visual padrão).
 *
 * Usar em todo lugar que encerra a sessão (logout, 401 interativo). Nunca
 * lança.
 */
export async function encerrarBrandingAutenticado(): Promise<void> {
  await clearConfigCache();
  requestThemeRefresh();
}
