import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_TOKEN_COOKIE } from '@/shared/lib/auth';
import RootPage from './page';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

const mockedCookies = vi.mocked(cookies);
const mockedRedirect = vi.mocked(redirect);

function jwtComRole(role: string): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64({ role })}.assinatura`;
}

function semSessao() {
  mockedCookies.mockReturnValue({ get: () => undefined } as unknown as ReturnType<typeof cookies>);
}

function comSessao(role: string) {
  mockedCookies.mockReturnValue({
    get: (name: string) => (name === ACCESS_TOKEN_COOKIE ? { value: jwtComRole(role) } : undefined),
  } as unknown as ReturnType<typeof cookies>);
}

describe('RootPage ("/")', () => {
  beforeEach(() => {
    mockedRedirect.mockReset();
  });

  it('mostra a landing page pra visitante sem sessão', () => {
    semSessao();

    render(<RootPage />);

    expect(screen.getByRole('heading', { level: 1, name: /carrega a sua marca/i })).toBeInTheDocument();
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('redireciona o aluno logado pro /treino, sem mostrar a landing', () => {
    comSessao('ALUNO');

    render(<RootPage />);

    expect(mockedRedirect).toHaveBeenCalledWith('/treino');
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('redireciona o personal logado pro /dashboard', () => {
    comSessao('PERSONAL');

    render(<RootPage />);

    expect(mockedRedirect).toHaveBeenCalledWith('/dashboard');
  });
});
