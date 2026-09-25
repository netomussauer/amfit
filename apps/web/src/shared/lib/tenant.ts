import { cookies } from 'next/headers';
import {
  CODIGO_CONVITE_REGEX,
  TenantConfigResponseSchema,
  type TenantConfigResponse,
} from '@amfit/shared';
import { ACCESS_TOKEN_COOKIE } from './auth';

// Mesma variável usada pelo proxy server-side em
// app/api/v1/[...path]/route.ts — reaproveitada aqui porque este fetch
// roda no mesmo processo Next.js (server), então não faz sentido dar a
// volta pelo próprio proxy relativo (`/api/v1`, que só existe pro
// browser evitar CORS).
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:8080';

/**
 * Busca a config de branding (White Label, SDD §20.4) do usuário
 * autenticado, direto no servidor — usado pelo layout raiz pra injetar as
 * CSS vars sem flash de tema. Funciona tanto pro personal (vê a própria
 * config) quanto pro aluno (vê a config do personal dele — resolvido pelo
 * backend a partir do JWT).
 *
 * Nunca lança: sem cookie de sessão, ou se o backend falhar por qualquer
 * motivo, devolve null e o layout cai pro visual default do app (definido
 * em globals.css) — branding é um complemento visual, nunca pode quebrar
 * o carregamento da página.
 */
export async function getTenantConfig(): Promise<TenantConfigResponse | null> {
  const token = cookies().get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${API_ORIGIN}/api/v1/tenants/me/config`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as TenantConfigResponse;
  } catch {
    return null;
  }
}

/**
 * Busca a config de branding PÚBLICA de um personal pelo código de convite
 * (GET /public/tenants/:codigo/config), direto no servidor e sem cookie de
 * sessão — usado pela página de convite `/entrar/[codigo]` (ADR-007,
 * nível 2: marca antes do login).
 *
 * Nunca lança: código malformado, inexistente (404) ou qualquer falha do
 * backend devolve null e a página cai no login padrão.
 */
export async function getPublicTenantConfig(
  codigo: string,
): Promise<TenantConfigResponse | null> {
  if (!CODIGO_CONVITE_REGEX.test(codigo)) return null;

  try {
    const res = await fetch(`${API_ORIGIN}/api/v1/public/tenants/${codigo}/config`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const parsed = TenantConfigResponseSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Monta o inline style de CSS vars a partir da config — undefined (sem
 * atributo style) quando não há config, deixando os defaults de
 * globals.css agirem normalmente. */
export function tenantConfigToCssVars(
  config: TenantConfigResponse | null,
): React.CSSProperties | undefined {
  if (!config) return undefined;
  return {
    '--color-primary': `#${config.cor_primaria}`,
    '--color-primary-hover': `#${config.cor_secundaria}`,
  } as React.CSSProperties;
}
