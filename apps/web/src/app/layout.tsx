import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/shared/components/providers/QueryProvider';
import { getTenantConfig, tenantConfigToCssVars } from '@/shared/lib/tenant';

export const metadata: Metadata = {
  title: 'AMFIT — Plataforma de Gestão de Treinos',
  description: 'Gerencie alunos, fichas e treinos com facilidade.',
};

type Props = {
  children: React.ReactNode;
};

// Injeção server-side das CSS vars de White Label (SDD §20.4) — sem
// rebuild, sem flash de tema (o HTML já chega do servidor com as cores do
// personal, diferente de aplicar via useEffect no client). Cobre tanto o
// portal do personal quanto a área do aluno porque o layout raiz envolve
// os dois — só usuários deslogados (sem cookie de sessão) veem o default.
export default async function RootLayout({ children }: Props) {
  const tenantConfig = await getTenantConfig();

  return (
    <html lang="pt-BR" style={tenantConfigToCssVars(tenantConfig)}>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
