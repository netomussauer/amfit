import type {
  ExercicioResponse,
  ItemTreinoResponse,
  RegistroSerieResponse,
  SessaoResponse,
  SessaoResumoResponse,
  SessaoListResponse,
} from '@amfit/shared';

export function makeExercicioResponse(
  overrides: Partial<ExercicioResponse> = {},
): ExercicioResponse {
  return {
    id: '10000000-0000-0000-0000-000000000001',
    nome: 'Supino Reto',
    descricao: null,
    grupo_muscular: { id: '20000000-0000-0000-0000-000000000001', nome: 'Peito' },
    midia_url: null,
    tipo_midia: null,
    is_global: true,
    ...overrides,
  };
}

export function makeItemTreinoResponse(
  overrides: Partial<ItemTreinoResponse> = {},
): ItemTreinoResponse {
  return {
    id: '30000000-0000-0000-0000-000000000001',
    ordem: 0,
    exercicio: makeExercicioResponse(),
    series: 3,
    repeticoes: '10',
    carga_sugerida: 40,
    descanso_segundos: 60,
    observacao: null,
    ...overrides,
  };
}

export function makeRegistroSerieResponse(
  overrides: Partial<RegistroSerieResponse> = {},
): RegistroSerieResponse {
  return {
    id: '40000000-0000-0000-0000-000000000001',
    item_treino_id: '30000000-0000-0000-0000-000000000001',
    numero_serie: 1,
    concluida: false,
    carga_realizada: null,
    repeticoes_realizadas: null,
    executado_em: null,
    ...overrides,
  };
}

export function makeSessaoResponse(
  overrides: Partial<SessaoResponse> = {},
): SessaoResponse {
  return {
    id: '50000000-0000-0000-0000-000000000001',
    treino_id: '60000000-0000-0000-0000-000000000001',
    data_execucao: '2026-08-31',
    status: 'EM_ANDAMENTO',
    iniciado_em: '2026-08-31T12:00:00.000Z',
    concluido_em: null,
    series: [],
    ...overrides,
  };
}

export function makeSessaoResumoResponse(
  overrides: Partial<SessaoResumoResponse> = {},
): SessaoResumoResponse {
  return {
    id: '50000000-0000-0000-0000-000000000001',
    treino_id: '60000000-0000-0000-0000-000000000001',
    treino_letra: 'A',
    treino_nome: 'Treino A',
    data_execucao: '2026-08-31',
    status: 'CONCLUIDO',
    iniciado_em: '2026-08-31T12:00:00.000Z',
    concluido_em: '2026-08-31T13:00:00.000Z',
    total_series: 12,
    series_concluidas: 12,
    ...overrides,
  };
}

export function makeSessaoListResponse(
  overrides: Partial<SessaoListResponse> = {},
): SessaoListResponse {
  return {
    data: [makeSessaoResumoResponse()],
    pagination: { total: 1, page: 1, per_page: 20 },
    ...overrides,
  };
}
