export { tenantService } from './services/tenant.service';
export {
  getConfigCache,
  setConfigCache,
  clearConfigCache,
  getPublicBranding,
  setPublicBranding,
  clearPublicBranding,
} from './lib/theme-cache';
export { requestThemeRefresh, setThemeRefreshHandler } from './lib/theme-refresh';
export { encerrarBrandingAutenticado } from './lib/branding-session';
// `useAplicarCodigoTenant` NÃO é exportado aqui de propósito: ele depende do
// expo-router, e este barril é importado por código (ex.: useLogin) e testes
// que não devem carregá-lo. Importe direto de './hooks/useAplicarCodigoTenant'.
