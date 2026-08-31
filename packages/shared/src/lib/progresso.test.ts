import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PontoProgressoResponse } from '../types';
import { buildEvolucaoCarga, calcularDataInicio } from './progresso';

function makePonto(overrides: Partial<PontoProgressoResponse> = {}): PontoProgressoResponse {
  return {
    sessao_id: '11111111-1111-1111-1111-111111111111',
    data_execucao: '2026-01-10',
    numero_serie: 1,
    carga_realizada: 50,
    repeticoes_realizadas: 10,
    ...overrides,
  };
}

describe('buildEvolucaoCarga', () => {
  it('retorna array vazio quando nao ha pontos', () => {
    expect(buildEvolucaoCarga([])).toEqual([]);
  });

  it('agrupa multiplas series da mesma sessao em um unico ponto do grafico', () => {
    const pontos: PontoProgressoResponse[] = [
      makePonto({ sessao_id: 'sessao-1', numero_serie: 1, carga_realizada: 40, repeticoes_realizadas: 10 }),
      makePonto({ sessao_id: 'sessao-1', numero_serie: 2, carga_realizada: 45, repeticoes_realizadas: 8 }),
      makePonto({ sessao_id: 'sessao-1', numero_serie: 3, carga_realizada: 42, repeticoes_realizadas: 9 }),
    ];

    const resultado = buildEvolucaoCarga(pontos);

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({
      sessaoId: 'sessao-1',
      totalSeries: 3,
      cargaMaxima: 45, // maior carga_realizada entre as 3 series
      volumeTotal: 40 * 10 + 45 * 8 + 42 * 9,
    });
  });

  it('calcula a carga maxima como o maior valor de carga_realizada da sessao', () => {
    const pontos: PontoProgressoResponse[] = [
      makePonto({ sessao_id: 's1', carga_realizada: 60 }),
      makePonto({ sessao_id: 's1', carga_realizada: 30 }),
    ];

    const [ponto] = buildEvolucaoCarga(pontos);

    expect(ponto.cargaMaxima).toBe(60);
  });

  it('ignora series com carga_realizada nulo no calculo de cargaMaxima e volume, mas conta em totalSeries', () => {
    const pontos: PontoProgressoResponse[] = [
      makePonto({ sessao_id: 's1', carga_realizada: 20, repeticoes_realizadas: 10 }),
      makePonto({ sessao_id: 's1', carga_realizada: null, repeticoes_realizadas: null }),
    ];

    const [ponto] = buildEvolucaoCarga(pontos);

    expect(ponto.totalSeries).toBe(2);
    expect(ponto.cargaMaxima).toBe(20);
    expect(ponto.volumeTotal).toBe(20 * 10);
  });

  it('retorna cargaMaxima nula quando nenhuma serie da sessao tem carga registrada', () => {
    const pontos: PontoProgressoResponse[] = [
      makePonto({ sessao_id: 's1', carga_realizada: null, repeticoes_realizadas: null }),
      makePonto({ sessao_id: 's1', carga_realizada: null, repeticoes_realizadas: null }),
    ];

    const [ponto] = buildEvolucaoCarga(pontos);

    expect(ponto.cargaMaxima).toBeNull();
    expect(ponto.volumeTotal).toBe(0);
    expect(ponto.totalSeries).toBe(2);
  });

  it('nao soma volume quando ha carga mas repeticoes_realizadas e nulo', () => {
    const pontos: PontoProgressoResponse[] = [
      makePonto({ sessao_id: 's1', carga_realizada: 20, repeticoes_realizadas: null }),
    ];

    const [ponto] = buildEvolucaoCarga(pontos);

    expect(ponto.cargaMaxima).toBe(20); // carga entra no array de cargas independente das reps
    expect(ponto.volumeTotal).toBe(0); // mas nao contribui pro volume sem reps
  });

  it('ordena as sessoes cronologicamente pela data de execucao', () => {
    const pontos: PontoProgressoResponse[] = [
      makePonto({ sessao_id: 's-depois', data_execucao: '2026-03-01' }),
      makePonto({ sessao_id: 's-antes', data_execucao: '2026-01-15' }),
      makePonto({ sessao_id: 's-meio', data_execucao: '2026-02-10' }),
    ];

    const resultado = buildEvolucaoCarga(pontos);

    expect(resultado.map((p) => p.sessaoId)).toEqual(['s-antes', 's-meio', 's-depois']);
  });

  it('mantem sessoes distintas separadas mesmo com a mesma data', () => {
    const pontos: PontoProgressoResponse[] = [
      makePonto({ sessao_id: 's1', data_execucao: '2026-01-10' }),
      makePonto({ sessao_id: 's2', data_execucao: '2026-01-10' }),
    ];

    const resultado = buildEvolucaoCarga(pontos);

    expect(resultado).toHaveLength(2);
  });
});

describe('calcularDataInicio', () => {
  beforeEach(() => {
    // Fuso fixo sem DST (America/Sao_Paulo, UTC-3) para reproduzir
    // deterministicamente o cenario descrito no comentario da funcao:
    // um instante UTC que, em horario local, ja e o dia anterior.
    // `vi.stubEnv` evita depender de tipos de @types/node (nao instalado
    // neste pacote) para tocar em `process.env` diretamente.
    vi.stubEnv('TZ', 'America/Sao_Paulo');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('usa a data LOCAL de hoje (nao a data UTC) quando dias=0', () => {
    // 2026-03-15T02:30:00Z em UTC-3 e 2026-03-14T23:30:00 no horario local —
    // ainda dia 14 localmente, embora ja seja dia 15 em UTC.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T02:30:00.000Z'));

    expect(calcularDataInicio(0)).toBe('2026-03-14');
  });

  it('subtrai dias a partir da data local, cruzando a virada de mes corretamente', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T02:30:00.000Z')); // local: 2026-03-14

    // 2026-03-14 menos 30 dias = 2026-02-12 (fevereiro/2026 tem 28 dias, ano nao bissexto)
    expect(calcularDataInicio(30)).toBe('2026-02-12');
  });

  it('retorna a data no formato YYYY-MM-DD com zero-padding em mes e dia', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T12:00:00.000Z')); // local: 2026-01-05

    expect(calcularDataInicio(1)).toBe('2026-01-04');
  });

  it('lida com a virada de ano', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-02T12:00:00.000Z')); // local: 2026-01-02

    expect(calcularDataInicio(5)).toBe('2025-12-28');
  });
});
