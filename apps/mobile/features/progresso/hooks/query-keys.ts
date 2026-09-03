import type { HistoricoExercicioQueryParams } from '../services/progresso.service';

export const progressoKeys = {
  all: ['meu-progresso'] as const,
  exercicio: (exercicioId: string, params?: HistoricoExercicioQueryParams) =>
    [...progressoKeys.all, exercicioId, params ?? {}] as const,
  sugestao: (exercicioId: string) => [...progressoKeys.all, exercicioId, 'sugestao'] as const,
};
