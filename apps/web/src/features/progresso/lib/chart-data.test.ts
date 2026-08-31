import { describe, expect, it } from 'vitest';
import { formatDataIso, formatNumero } from './chart-data';

describe('formatDataIso', () => {
  it('converte uma data ISO (YYYY-MM-DD) para o formato brasileiro DD/MM/YYYY', () => {
    expect(formatDataIso('2026-03-14')).toBe('14/03/2026');
  });

  it('faz zero-padding preservado (nao remove zeros a esquerda)', () => {
    expect(formatDataIso('2026-01-05')).toBe('05/01/2026');
  });

  it('retorna a string original quando o input nao tem 3 segmentos separados por hifen', () => {
    expect(formatDataIso('data-invalida')).toBe('data-invalida');
    expect(formatDataIso('')).toBe('');
  });
});

describe('formatNumero', () => {
  it('formata inteiros sem casas decimais', () => {
    expect(formatNumero(50)).toBe('50');
    expect(formatNumero(0)).toBe('0');
  });

  it('formata decimais com 1 casa, usando virgula como separador', () => {
    expect(formatNumero(12.5)).toBe('12,5');
    expect(formatNumero(12.34)).toBe('12,3'); // toFixed(1) arredonda para 1 casa
  });

  it('remove o ".0" residual quando o arredondamento resulta em um numero inteiro', () => {
    expect(formatNumero(12.04)).toBe('12'); // toFixed(1) -> "12.0" -> vira "12"
  });

  it('formata numeros negativos corretamente', () => {
    expect(formatNumero(-5.5)).toBe('-5,5');
  });
});
