import { describe, expect, it } from 'vitest';
import { formatBRL, formatCompetencia, formatCompetenciaCurta, formatPercent } from './format';

describe('formatBRL', () => {
  it('formata um valor como moeda brasileira', () => {
    expect(formatBRL(200)).toBe('R$ 200,00');
  });

  it('formata valores com centavos', () => {
    expect(formatBRL(199.9)).toBe('R$ 199,90');
  });
});

describe('formatCompetencia', () => {
  it('formata ano/mes como MM/AAAA com mes preenchido com zero', () => {
    expect(formatCompetencia(2026, 9)).toBe('09/2026');
  });

  it('nao adiciona zero quando o mes ja tem dois digitos', () => {
    expect(formatCompetencia(2026, 12)).toBe('12/2026');
  });
});

describe('formatCompetenciaCurta', () => {
  it('formata como abreviacao do mes + ano com 2 digitos', () => {
    expect(formatCompetenciaCurta(2026, 9)).toBe('set/26');
  });

  it('funciona para janeiro e dezembro (limites do array)', () => {
    expect(formatCompetenciaCurta(2027, 1)).toBe('jan/27');
    expect(formatCompetenciaCurta(2026, 12)).toBe('dez/26');
  });
});

describe('formatPercent', () => {
  it('formata com uma casa decimal e simbolo de porcentagem', () => {
    expect(formatPercent(20)).toBe('20,0%');
  });

  it('arredonda para uma casa decimal', () => {
    expect(formatPercent(8.333)).toBe('8,3%');
  });

  it('formata zero corretamente', () => {
    expect(formatPercent(0)).toBe('0,0%');
  });
});
