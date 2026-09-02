import type {
  ExercicioResponse,
  FichaResponse,
  ItemTreinoResponse,
  TreinoHojeResponse,
  TreinoResponse,
} from '@amfit/shared';

export function makeExercicio(
  overrides: Partial<ExercicioResponse> = {},
): ExercicioResponse {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    nome: 'Supino reto',
    descricao: null,
    grupo_muscular: { id: '11111111-1111-1111-1111-111111111111', nome: 'Peito' },
    midia_url: null,
    tipo_midia: null,
    is_global: false,
    ...overrides,
  };
}

export function makeItemTreino(
  overrides: Partial<ItemTreinoResponse> = {},
): ItemTreinoResponse {
  return {
    id: '33333333-3333-3333-3333-333333333333',
    ordem: 0,
    exercicio: makeExercicio(),
    series: 3,
    repeticoes: '10-12',
    carga_sugerida: 80,
    descanso_segundos: 60,
    observacao: null,
    ...overrides,
  };
}

export function makeTreino(overrides: Partial<TreinoResponse> = {}): TreinoResponse {
  return {
    id: '44444444-4444-4444-4444-444444444444',
    letra: 'A',
    nome: 'Peito e tríceps',
    ordem: 0,
    itens: [makeItemTreino()],
    ...overrides,
  };
}

export function makeFicha(overrides: Partial<FichaResponse> = {}): FichaResponse {
  return {
    id: '55555555-5555-5555-5555-555555555555',
    nome: 'Ficha de hipertrofia',
    aluno_id: '66666666-6666-6666-6666-666666666666',
    vigencia_inicio: '2026-01-01',
    vigencia_fim: null,
    ativa: true,
    treinos: [makeTreino()],
    ...overrides,
  };
}

export function makeTreinoHoje(
  overrides: Partial<TreinoHojeResponse> = {},
): TreinoHojeResponse {
  return {
    treino: makeTreino(),
    sessao_hoje_id: null,
    ...overrides,
  };
}
