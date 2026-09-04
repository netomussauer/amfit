import { describe, expect, it } from 'vitest';
import { formatBRL, formatCompetencia } from './format';

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
