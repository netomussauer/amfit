import type {
  HistoricoExercicioResponse,
  PontoProgressoResponse,
  SugestaoProgressaoResponse,
} from '@amfit/shared';
import type { EvolucaoCargaPoint } from '../lib/chart-data';

export function makePontoProgresso(
  overrides: Partial<PontoProgressoResponse> = {},
): PontoProgressoResponse {
  return {
    sessao_id: '11111111-1111-1111-1111-111111111111',
    data_execucao: '2026-08-01',
    numero_serie: 1,
    carga_realizada: 80,
    repeticoes_realizadas: 10,
    ...overrides,
  };
}

export function makeHistoricoExercicioResponse(
  overrides: Partial<HistoricoExercicioResponse> = {},
): HistoricoExercicioResponse {
  return {
    aluno_id: '22222222-2222-2222-2222-222222222222',
    exercicio_id: '33333333-3333-3333-3333-333333333333',
    pontos: [makePontoProgresso()],
    ...overrides,
  };
}

export function makeSugestaoProgressaoResponse(
  overrides: Partial<SugestaoProgressaoResponse> = {},
): SugestaoProgressaoResponse {
  return {
    exercicio_id: '33333333-3333-3333-3333-333333333333',
    tem_sugestao: true,
    direcao: 'AUMENTAR',
    carga_sugerida: 22.5,
    ultima_carga_registrada: 20,
    ultima_media_repeticoes: 10,
    ...overrides,
  };
}

export function makeEvolucaoCargaPoint(
  overrides: Partial<EvolucaoCargaPoint> = {},
): EvolucaoCargaPoint {
  return {
    sessaoId: '11111111-1111-1111-1111-111111111111',
    data: '2026-08-01',
    cargaMaxima: 80,
    volumeTotal: 800,
    totalSeries: 3,
    ...overrides,
  };
}
