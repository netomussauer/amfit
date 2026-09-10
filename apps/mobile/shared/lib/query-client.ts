import { QueryClient } from '@tanstack/react-query';

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
