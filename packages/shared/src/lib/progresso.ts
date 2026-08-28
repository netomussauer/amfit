import type { PontoProgressoResponse } from '../schemas/progresso.schema';

export type EvolucaoCargaPoint = {
  sessaoId: string;
  data: string;
  cargaMaxima: number | null;
  volumeTotal: number;
  totalSeries: number;
};

/**
 * Agrupa os pontos de progresso (um por série executada) por sessão,
 * calculando a carga máxima movimentada e o volume total (carga × reps)
 * de cada sessão. Retorna a série ordenada cronologicamente — pronta
 * para alimentar um gráfico de evolução de carga.
 *
 * Compartilhado entre web e mobile para que uma correção na lógica de
 * agregação não precise ser replicada em duas cópias independentes.
 */
export function buildEvolucaoCarga(
  pontos: PontoProgressoResponse[],
): EvolucaoCargaPoint[] {
  const porSessao = new Map<
    string,
    { data: string; cargas: number[]; volume: number; totalSeries: number }
  >();

  for (const ponto of pontos) {
    const entry = porSessao.get(ponto.sessao_id) ?? {
      data: ponto.data_execucao,
      cargas: [],
      volume: 0,
      totalSeries: 0,
    };
    entry.totalSeries += 1;

    if (typeof ponto.carga_realizada === 'number') {
      entry.cargas.push(ponto.carga_realizada);
      if (typeof ponto.repeticoes_realizadas === 'number') {
        entry.volume += ponto.carga_realizada * ponto.repeticoes_realizadas;
      }
    }

    porSessao.set(ponto.sessao_id, entry);
  }

  return Array.from(porSessao.entries())
    .map(([sessaoId, entry]) => ({
      sessaoId,
      data: entry.data,
      cargaMaxima: entry.cargas.length > 0 ? Math.max(...entry.cargas) : null,
      volumeTotal: entry.volume,
      totalSeries: entry.totalSeries,
    }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Calcula a data (YYYY-MM-DD) de `dias` atrás a partir de hoje, usando os
 * componentes de data LOCAIS (getFullYear/getMonth/getDate) em vez de
 * `toISOString()` (que converte para UTC). Evitar `toISOString()` aqui é
 * importante: num fuso negativo (ex: America/Sao_Paulo, UTC-3), calcular a
 * data local e depois formatar via `toISOString().slice(0, 10)` desloca o
 * resultado em 1 dia sempre que o horário local já passou da meia-noite
 * UTC (aprox. 21h-23h59 local) — o filtro "from" enviado à API fica um dia
 * à frente do esperado e exclui o dia mais antigo da janela solicitada.
 */
export function calcularDataInicio(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() - dias);
  const yyyy = data.getFullYear();
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const dd = String(data.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
