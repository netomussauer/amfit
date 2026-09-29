import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { ACCESS_TOKEN_COOKIE, parseJwt } from '@/shared/lib/auth';
import { LandingPage } from '@/features/landing';

// Quem já tem sessão vai direto pra própria home — a landing page é só
// pra visitante anônimo (o antigo comportamento era redirecionar sem
// exceção pro /login, sem nenhuma página pública em "/").
export default function RootPage() {
  const token = cookies().get(ACCESS_TOKEN_COOKIE);

  if (token) {
    const role = parseJwt(token.value)?.role;
    redirect(role === 'ALUNO' ? '/treino' : '/dashboard');
    return null;
  }

  return <LandingPage />;
}
