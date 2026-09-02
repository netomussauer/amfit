import type { ExercicioResponse, GrupoMuscular } from '@amfit/shared';

export function makeGrupoMuscular(
  overrides: Partial<GrupoMuscular> = {},
): GrupoMuscular {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    nome: 'Peito',
    ...overrides,
  };
}

export function makeExercicio(
  overrides: Partial<ExercicioResponse> = {},
): ExercicioResponse {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    nome: 'Supino reto',
    descricao: null,
    grupo_muscular: makeGrupoMuscular(),
    midia_url: null,
    tipo_midia: null,
    is_global: false,
    ...overrides,
  };
}
