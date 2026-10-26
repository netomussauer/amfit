import { queryClient } from './query-client';
import { CACHE_MAX_AGE_MS, PERSISTED_QUERY_ROOTS } from './query-persist-config';

describe('queryClient', () => {
  it('usa os defaults do app: queries com staleTime de 1 min e 1 retry; mutations sem retry', () => {
    const { queries, mutations } = queryClient.getDefaultOptions();

    expect(queries?.staleTime).toBe(60_000);
    expect(queries?.retry).toBe(1);
    expect(mutations?.retry).toBe(0);
  });

  it.each(PERSISTED_QUERY_ROOTS.map((r) => [r]))(
    'raiz persistida "%s" tem gcTime igual ao maxAge do cache em disco',
    (raiz) => {
      expect(queryClient.getQueryDefaults([raiz]).gcTime).toBe(CACHE_MAX_AGE_MS);
    },
  );

  it('raizes nao persistidas mantem o gcTime padrao do React Query', () => {
    expect(queryClient.getQueryDefaults(['perfil']).gcTime).toBeUndefined();
    expect(queryClient.getQueryDefaults(['mensalidades']).gcTime).toBeUndefined();
  });

  it('o gcTime das raizes persistidas nunca e menor que o maxAge (senao a query some do disco)', () => {
    for (const raiz of PERSISTED_QUERY_ROOTS) {
      const gcTime = queryClient.getQueryDefaults([raiz]).gcTime ?? 0;
      expect(gcTime).toBeGreaterThanOrEqual(CACHE_MAX_AGE_MS);
    }
  });
});
