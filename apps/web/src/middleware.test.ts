import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { ACCESS_TOKEN_COOKIE } from '@/shared/lib/auth';
import { config, middleware } from './middleware';

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

// O Next.js só invoca a função `middleware` para caminhos batidos pelo
// `config.matcher` — chamar `middleware()` direto num teste (como acima)
// nunca pega um prefixo esquecido no matcher, porque o matcher só existe
// nessa config, não na lógica interna da função. Faltou justamente isso
// pro /modelos numa entrega anterior (achado de code-review): a rota
// entrou em PERSONAL_PREFIXES mas nao no matcher, entao a protecao nunca
// rodava de verdade em producao.
describe('middleware — config.matcher cobre toda rota protegida', () => {
  const PREFIXOS_PROTEGIDOS_ESPERADOS = [
    'dashboard',
    'alunos',
    'exercicios',
    'configuracoes',
    'modelos',
    'treino',
    'historico',
    'progresso',
    'perfil',
  ];

  it.each(PREFIXOS_PROTEGIDOS_ESPERADOS)('inclui /%s/:path* no matcher', (prefixo) => {
    expect(config.matcher).toContain(`/${prefixo}/:path*`);
  });
});
