import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { ACCESS_TOKEN_COOKIE } from '@/shared/lib/auth';
import { middleware } from './middleware';

function jwtComRole(role: string): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64({ role })}.assinatura`;
}

function requisicao(path: string, role?: string): NextRequest {
  const headers = role ? { cookie: `${ACCESS_TOKEN_COOKIE}=${jwtComRole(role)}` } : undefined;
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

describe('middleware — página de convite /entrar/[codigo]', () => {
  it('deixa quem não tem sessão ver a página de convite', () => {
    const res = middleware(requisicao('/entrar/K7M2QX9P'));

    expect(res.headers.get('location')).toBeNull();
  });

  it('manda o aluno já logado para a própria home (como o /login)', () => {
    const res = middleware(requisicao('/entrar/K7M2QX9P', 'ALUNO'));

    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/treino');
  });

  it('manda o personal já logado para o dashboard', () => {
    const res = middleware(requisicao('/entrar/K7M2QX9P', 'PERSONAL'));

    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/dashboard');
  });

  it('continua redirecionando o /login de quem já tem sessão', () => {
    const res = middleware(requisicao('/login', 'ALUNO'));

    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/treino');
  });
});
