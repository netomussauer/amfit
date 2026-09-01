import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_TOKEN_COOKIE, parseJwt } from '@/shared/lib/auth';

// Rotas do portal do personal (gestão de alunos/exercícios/fichas).
const PERSONAL_PREFIXES = ['/dashboard', '/alunos', '/exercicios', '/configuracoes'];
// Rotas do portal do aluno (visão + execução do próprio treino).
const ALUNO_PREFIXES = ['/treino', '/historico', '/progresso', '/perfil'];
const PROTECTED_PREFIXES = [...PERSONAL_PREFIXES, ...ALUNO_PREFIXES];
const PUBLIC_AUTH_PATHS = ['/login', '/register'];

function homeFor(role: string | undefined): string {
  return role === 'ALUNO' ? '/treino' : '/dashboard';
}

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  // Decodificação sem verificação de assinatura — só pra roteamento/UX.
  // A autorização de verdade é sempre imposta pelo backend Go
  // (RequirePerfil), que valida a assinatura a cada request.
  const role = token ? parseJwt(token)?.role : undefined;

  const isProtected = matchesPrefix(pathname, PROTECTED_PREFIXES);

  if (isProtected && !token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Usuário autenticado tentando acessar a área do outro perfil — evita a
  // tela "vazia" que motivou este fix (aluno caindo no dashboard do
  // personal, sem dados, sem nav própria).
  if (token && role) {
    const inPersonalArea = matchesPrefix(pathname, PERSONAL_PREFIXES);
    const inAlunoArea = matchesPrefix(pathname, ALUNO_PREFIXES);
    if ((role === 'ALUNO' && inPersonalArea) || (role === 'PERSONAL' && inAlunoArea)) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = homeFor(role);
      homeUrl.search = '';
      return NextResponse.redirect(homeUrl);
    }
  }

  if (token && PUBLIC_AUTH_PATHS.includes(pathname)) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = homeFor(role);
    homeUrl.search = '';
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/alunos/:path*',
    '/exercicios/:path*',
    '/configuracoes/:path*',
    '/treino/:path*',
    '/historico/:path*',
    '/progresso/:path*',
    '/perfil/:path*',
    '/login',
    '/register',
  ],
};
