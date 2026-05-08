import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { ACCESS_TOKEN_COOKIE } from '@/shared/lib/auth';

export default function RootPage() {
  const token = cookies().get(ACCESS_TOKEN_COOKIE);

  if (token) {
    redirect('/dashboard');
  }

  redirect('/login');
}
