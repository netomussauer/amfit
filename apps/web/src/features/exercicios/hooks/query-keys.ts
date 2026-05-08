export type ExercicioListParams = {
  grupo_muscular_id?: string;
  busca?: string;
};

export const exercicioKeys = {
  all: ['exercicios'] as const,
  lists: () => [...exercicioKeys.all, 'list'] as const,
  list: (params: ExercicioListParams) => [...exercicioKeys.lists(), params] as const,
  details: () => [...exercicioKeys.all, 'detail'] as const,
  detail: (id: string) => [...exercicioKeys.details(), id] as const,
  grupos: () => ['grupos-musculares'] as const,
};
