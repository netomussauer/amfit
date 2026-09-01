import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { ACCESS_TOKEN_COOKIE, parseJwt } from '@/shared/lib/auth';

export default function RootPage() {
  const token = cookies().get(ACCESS_TOKEN_COOKIE);

  if (token) {
    const role = parseJwt(token.value)?.role;
    redirect(role === 'ALUNO' ? '/treino' : '/dashboard');
  }

  redirect('/login');
}
