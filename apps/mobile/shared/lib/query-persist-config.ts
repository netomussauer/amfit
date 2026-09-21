// Constantes do cache persistido, em módulo próprio e sem imports: são
// lidas por `query-client.ts` (que não deve puxar o AsyncStorage nem o
// persister só por isso) e por `query-persist.ts`.

// AsyncStorage no Android é texto puro dentro do sandbox do app (não
// criptografado), então só entra em disco o necessário pro fluxo de treino
// — nada de dado pessoal (perfil, mensalidades) nem URL pré-assinada que
// expira. Chave = raiz da query key. Estender = uma linha aqui.
export const PERSISTED_QUERY_ROOTS: readonly string[] = [
  'treino', // treinoKeys — treino de hoje
  'minha-ficha', // fichaKeys — ficha ativa
  'sessoes', // sessaoKeys — sessão em andamento, inclusive IDs `local-…`
];

// Descarta o que passar disso na restauração. Precisa cobrir quanto tempo
// uma sessão iniciada offline pode ficar na fila. O `gcTime` das raízes
// persistidas (shared/lib/query-client.ts) precisa ser >= a este valor,
// senão o React Query descarta queries inativas antes e elas somem do
// disco na próxima gravação.
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Incrementar quando mudar o formato de uma resposta cacheada: um cache
// persistido com o formato antigo seria restaurado como se fosse válido.
export const CACHE_SCHEMA_VERSION = '1';
