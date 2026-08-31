import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * QueryClient de teste: retries desligados (para nao fazer testes de estado
 * de erro esperarem os backoffs reais) e sem garbage collection de cache
 * entre asserts do mesmo teste.
 *
 * Template compartilhado para testes de hooks/features que usam TanStack
 * Query — importe `createTestQueryClient` + `QueryWrapper` em vez de
 * duplicar esta configuracao em cada feature.
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

type Props = {
  children: ReactNode;
  client?: QueryClient;
};

export function QueryWrapper({ children, client }: Props) {
  return (
    <QueryClientProvider client={client ?? createTestQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}
