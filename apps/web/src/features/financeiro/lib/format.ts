export function formatBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatCompetencia(ano: number, mes: number): string {
  return `${String(mes).padStart(2, '0')}/${ano}`;
}

const MESES_ABREVIADOS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

/** Formato curto para eixo de gráfico (ex.: "set/26") — `mes` é 1-12. */
export function formatCompetenciaCurta(ano: number, mes: number): string {
  return `${MESES_ABREVIADOS[mes - 1]}/${String(ano).slice(-2)}`;
}

export function formatPercent(pct: number): string {
  return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
