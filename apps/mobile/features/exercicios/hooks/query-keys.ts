import type { ListarExerciciosParams } from '../services/exercicio.service';

export const exercicioKeys = {
  all: ['exercicios'] as const,
  lists: () => [...exercicioKeys.all, 'list'] as const,
  list: (params: ListarExerciciosParams) =>
    [...exercicioKeys.lists(), params] as const,
  details: () => [...exercicioKeys.all, 'detail'] as const,
  detail: (id: string) => [...exercicioKeys.details(), id] as const,
};

export const grupoMuscularKeys = {
  all: ['grupos-musculares'] as const,
  list: () => [...grupoMuscularKeys.all, 'list'] as const,
};
