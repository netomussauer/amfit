export type HistoricoExercicioParams = {
  alunoId: string;
  exercicioId: string;
  from?: string;
  to?: string;
  limit?: number;
};

export const progressoKeys = {
  all: ['progresso'] as const,
  dashboard: () => [...progressoKeys.all, 'dashboard'] as const,
  historico: (params: HistoricoExercicioParams) =>
    [...progressoKeys.all, 'historico', params] as const,
};
