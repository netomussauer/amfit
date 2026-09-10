import type { RegistroSerieResponse, SessaoResponse } from '@amfit/shared';

/**
 * Upsert de uma série no cache da sessão, por (item_treino_id, numero_serie)
 * — mesma chave natural usada pelo backend pra decidir entre INSERT/UPDATE.
 * Usado tanto pelo `onSuccess` de `useRegistrarSerie` (sync interativo)
 * quanto por `offlineSyncEngine` (sync em segundo plano), pra não haver
 * duas implementações do mesmo merge que possam divergir com o tempo.
 */
export function mergeSerieIntoSessao(
  sessao: SessaoResponse,
  registro: RegistroSerieResponse,
): SessaoResponse {
  const idx = sessao.series.findIndex(
    (s) =>
      s.item_treino_id === registro.item_treino_id &&
      s.numero_serie === registro.numero_serie,
  );
  const series =
    idx >= 0
      ? sessao.series.map((s, i) => (i === idx ? registro : s))
      : [...sessao.series, registro];
  return { ...sessao, series };
}
