import { SESSAO_STATUS, type SessaoResponse } from '@amfit/shared';

const LOCAL_ID_PREFIX = 'local-';

/** Gera um ID de sessão local — usado como placeholder enquanto o
 * `iniciar_sessao` real ainda não foi sincronizado com o backend. Sem
 * `expo-crypto`/`uuid` de propósito (não são dependências do projeto). */
export function generateLocalSessaoId(): string {
  return `${LOCAL_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isLocalSessaoId(id: string): boolean {
  return id.startsWith(LOCAL_ID_PREFIX);
}

function todayLocalDateString(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Sessão sintética usada como resposta otimista de `useIniciarSessao`
 * quando offline — substituída pela sessão real assim que
 * `offlineSyncEngine` sincroniza o item `iniciar_sessao` correspondente. */
export function buildPlaceholderSessao(localId: string, treinoId: string): SessaoResponse {
  return {
    id: localId,
    treino_id: treinoId,
    data_execucao: todayLocalDateString(),
    status: SESSAO_STATUS.EM_ANDAMENTO,
    iniciado_em: new Date().toISOString(),
    concluido_em: null,
    series: [],
  };
}
