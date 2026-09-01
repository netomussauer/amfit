import { describe, expect, it } from 'vitest';
import { formatDataIso, formatDuracao, statusVisual } from './format';

describe('formatDataIso', () => {
  it('converte uma data ISO (YYYY-MM-DD) para o formato brasileiro DD/MM/YYYY', () => {
    expect(formatDataIso('2026-03-14')).toBe('14/03/2026');
  });

  it('preserva zero-padding', () => {
    expect(formatDataIso('2026-01-05')).toBe('05/01/2026');
  });

  it('retorna a string original quando o input nao tem 3 segmentos separados por hifen', () => {
    expect(formatDataIso('data-invalida')).toBe('data-invalida');
    expect(formatDataIso('')).toBe('');
  });
});

describe('formatDuracao', () => {
  it('retorna null quando fim esta ausente (sessao em andamento)', () => {
    expect(formatDuracao('2026-01-10T10:00:00Z', null)).toBeNull();
    expect(formatDuracao('2026-01-10T10:00:00Z', undefined)).toBeNull();
  });

  it('retorna null quando inicio ou fim sao datas invalidas', () => {
    expect(formatDuracao('data-invalida', '2026-01-10T10:00:00Z')).toBeNull();
    expect(formatDuracao('2026-01-10T10:00:00Z', 'data-invalida')).toBeNull();
  });

  it('formata duracoes menores que 1 minuto em segundos', () => {
    expect(formatDuracao('2026-01-10T10:00:00Z', '2026-01-10T10:00:45Z')).toBe('45s');
  });

  it('formata duracoes menores que 1 hora em minutos', () => {
    expect(formatDuracao('2026-01-10T10:00:00Z', '2026-01-10T10:25:00Z')).toBe('25m');
  });

  it('formata duracoes com horas exatas sem minutos', () => {
    expect(formatDuracao('2026-01-10T10:00:00Z', '2026-01-10T12:00:00Z')).toBe('2h');
  });

  it('formata duracoes com horas e minutos, preenchendo minutos com zero a esquerda', () => {
    expect(formatDuracao('2026-01-10T10:00:00Z', '2026-01-10T11:05:00Z')).toBe('1h05m');
  });

  it('arredonda para 0 quando fim e anterior ao inicio (nao retorna negativo)', () => {
    expect(formatDuracao('2026-01-10T11:00:00Z', '2026-01-10T10:00:00Z')).toBe('0s');
  });
});

describe('statusVisual', () => {
  it('retorna label e classe para EM_ANDAMENTO', () => {
    expect(statusVisual('EM_ANDAMENTO')).toEqual({
      label: 'Em andamento',
      className: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
    });
  });

  it('retorna label e classe para CONCLUIDO', () => {
    expect(statusVisual('CONCLUIDO')).toEqual({
      label: 'Concluído',
      className: 'bg-green-50 text-[--color-success] border border-green-200',
    });
  });

  it('retorna label e classe para ABANDONADO', () => {
    expect(statusVisual('ABANDONADO')).toEqual({
      label: 'Abandonado',
      className: 'bg-slate-100 text-[--color-text-muted] border border-slate-200',
    });
  });

  it('usa o proprio valor como label de fallback para status desconhecido', () => {
    // @ts-expect-error -- exercitando o branch default com um valor fora do enum
    expect(statusVisual('STATUS_INEXISTENTE')).toEqual({
      label: 'STATUS_INEXISTENTE',
      className: 'bg-slate-100 text-[--color-text-muted] border border-slate-200',
    });
  });
});
