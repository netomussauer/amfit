import { QueryClient } from '@tanstack/react-query';
import { CACHE_MAX_AGE_MS, PERSISTED_QUERY_ROOTS } from './query-persist-config';

// Extraído de app/_layout.tsx pra poder ser importado fora de componentes
// (hooks de fila offline, o motor de sync) sem criar uma segunda instância.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Só as raízes que vão pro disco ficam em memória por tanto tempo: o
// `gcTime` padrão (5 min) descartaria uma query inativa antes de ela ser
// gravada de novo, e ela sumiria do cache persistido. O resto do app
// (perfil, financeiro, listas de exercícios…) mantém o padrão, senão o
// cache cresceria por uma semana sem nada disso ser persistido.
for (const raiz of PERSISTED_QUERY_ROOTS) {
  queryClient.setQueryDefaults([raiz], { gcTime: CACHE_MAX_AGE_MS });
}
