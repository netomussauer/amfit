export { buildEvolucaoCarga, calcularDataInicio } from '@amfit/shared';
export type { EvolucaoCargaPoint } from '@amfit/shared';

export function formatDataIso(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-');
  if (!yyyy || !mm || !dd) return iso;
  return `${dd}/${mm}/${yyyy}`;
}

export function formatNumero(n: number): string {
  const formatted = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
  return formatted.replace('.', ',');
}
