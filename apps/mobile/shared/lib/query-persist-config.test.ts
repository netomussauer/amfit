import {
  CACHE_MAX_AGE_MS,
  CACHE_SCHEMA_VERSION,
  PERSISTED_QUERY_ROOTS,
} from './query-persist-config';

describe('query-persist-config', () => {
  it('persiste apenas as raizes do fluxo de treino', () => {
    expect([...PERSISTED_QUERY_ROOTS].sort()).toEqual(['minha-ficha', 'sessoes', 'treino']);
  });

  // AsyncStorage no Android e texto puro no sandbox do app: dado pessoal e URL
  // pre-assinada nao podem ir pra disco. Este teste trava uma inclusao acidental.
  it.each(['perfil', 'aluno-me', 'financeiro', 'mensalidades', 'meu-plano', 'coach', 'tenant'])(
    'nao persiste a raiz sensivel "%s"',
    (raiz) => {
      expect(PERSISTED_QUERY_ROOTS).not.toContain(raiz);
    },
  );

  it('as raizes sao unicas e nao vazias', () => {
    expect(new Set(PERSISTED_QUERY_ROOTS).size).toBe(PERSISTED_QUERY_ROOTS.length);
    expect(PERSISTED_QUERY_ROOTS.every((r) => r.length > 0)).toBe(true);
  });

  it('o cache vale 7 dias, tempo maximo que uma sessao offline pode ficar na fila', () => {
    expect(CACHE_MAX_AGE_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('tem versao de schema nao vazia (invalida cache de formato antigo ao incrementar)', () => {
    expect(CACHE_SCHEMA_VERSION).not.toBe('');
  });
});
