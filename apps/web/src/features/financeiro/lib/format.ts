export function formatBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatCompetencia(ano: number, mes: number): string {
  return `${String(mes).padStart(2, '0')}/${ano}`;
}
