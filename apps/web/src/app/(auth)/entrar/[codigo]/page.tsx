import Link from 'next/link';
import { normalizarCodigoConvite } from '@amfit/shared';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { getPublicTenantConfig, tenantConfigToCssVars } from '@/shared/lib/tenant';

export const metadata = {
  title: 'Entrar — AMFIT',
};

// Sequência de % malformada na URL não pode derrubar a página (500): cai
// no mesmo "Convite não encontrado" de um código inválido.
function decodificar(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

// Página pública de convite (ADR-007, nível 2): login já com a marca do
// personal dono do código. Sem sessão, então o branding vem do endpoint
// público — o layout raiz só injeta CSS vars para quem tem cookie.
export default async function EntrarPage({ params }: { params: { codigo: string } }) {
  const codigo = normalizarCodigoConvite(decodificar(params.codigo));
  const config = await getPublicTenantConfig(codigo);

  if (!config) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[--color-bg-subtle]">
        <div className="w-full max-w-md rounded-lg border border-[--color-border] bg-[--color-bg] p-8 text-center shadow-md">
          <h1 className="text-xl font-bold text-[--color-text]">Convite não encontrado</h1>
          <p role="alert" className="mt-2 text-sm text-[--color-text-muted]">
            Este link de convite não é válido ou foi substituído. Peça um novo ao seu personal
            trainer, ou entre normalmente.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white hover:bg-[--color-primary-hover]"
          >
            Ir para o login
          </Link>
        </div>
      </main>
    );
  }

  const nomeApp = config.nome_app?.trim() ? config.nome_app : 'AMFIT';

  return (
    <main
      style={tenantConfigToCssVars(config)}
      className="flex min-h-screen items-center justify-center bg-[--color-bg-subtle]"
    >
      <div className="w-full max-w-md rounded-lg border border-[--color-border] bg-[--color-bg] p-8 shadow-md">
        <div className="mb-8 text-center">
          {config.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo remoto (MinIO), next/image exigiria domínio configurado à parte
            <img
              src={config.logo_url}
              alt={`Logo ${nomeApp}`}
              className="mx-auto mb-4 h-16 w-auto object-contain"
            />
          ) : null}
          <h1 className="text-2xl font-bold text-[--color-text]">{nomeApp}</h1>
          <p className="mt-1 text-sm text-[--color-text-muted]">
            Acesse sua conta para continuar
          </p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-xs text-[--color-text-muted]">
          Prefere o aplicativo?{' '}
          <a
            href={`amfit://entrar/${codigo}`}
            className="font-medium text-[--color-primary] hover:underline"
          >
            Abrir no app
          </a>
        </p>
      </div>
    </main>
  );
}
