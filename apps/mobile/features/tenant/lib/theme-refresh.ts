// Mesmo padrão de setAuthFailedHandler (shared/lib/api-client.ts): um
// handler mutável em nível de módulo, registrado pelo ThemeProvider
// (montado uma vez, na raiz do app) e disparado por código que não tem
// (nem deveria ter) acesso direto ao estado de tema do provider — como
// useLogin, depois de um login bem-sucedido.
let onThemeRefreshNeeded: (() => void) | null = null;

export function setThemeRefreshHandler(handler: (() => void) | null): void {
  onThemeRefreshNeeded = handler;
}

/**
 * Pede pro ThemeProvider buscar a config de branding de novo — usado após
 * login bem-sucedido, já que o efeito de mount do ThemeProvider só roda
 * uma vez por cold start e não veria um login que aconteça depois (achado
 * de code-review: sem isso, um aluno logando pela primeira vez numa
 * instalação nova só via a marca do personal dele depois de reabrir o
 * app).
 */
export function requestThemeRefresh(): void {
  onThemeRefreshNeeded?.();
}
