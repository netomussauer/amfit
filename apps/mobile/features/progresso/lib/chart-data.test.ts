import { formatDataIso, formatNumero } from './chart-data';

// `buildEvolucaoCarga` e `calcularDataInicio` são apenas reexportados deste
// módulo — a lógica em si vive em `@amfit/shared` (packages/shared/src/lib/progresso.ts)
// e não é coberta aqui de propósito, para não duplicar a cobertura de testes
// de uma lógica pura compartilhada entre web e mobile. Ver observação no
// relatório final sobre o status de cobertura desse arquivo no pacote shared.

describe('formatDataIso', () => {
  it('converte uma data ISO (YYYY-MM-DD) para o formato dd/mm', () => {
    expect(formatDataIso('2026-08-31')).toBe('31/08');
  });

  it('preenche com zero à esquerda quando dia/mês tem um dígito', () => {
    expect(formatDataIso('2026-01-05')).toBe('05/01');
  });

  it('retorna a string original quando o formato é inválido', () => {
    expect(formatDataIso('2026-08')).toBe('2026-08');
    expect(formatDataIso('')).toBe('');
  });
});

describe('formatNumero', () => {
  it('formata inteiros sem casas decimais', () => {
    expect(formatNumero(82)).toBe('82');
    expect(formatNumero(0)).toBe('0');
  });

  it('usa vírgula como separador decimal', () => {
    expect(formatNumero(82.5)).toBe('82,5');
  });

  it('arredonda para uma casa decimal', () => {
    expect(formatNumero(82.567)).toBe('82,6');
  });

  it('remove ".0" residual e trata como inteiro', () => {
    expect(formatNumero(82.04)).toBe('82');
  });
});
