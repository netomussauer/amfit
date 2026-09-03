export type MeuProgressoParams = {
  exercicioId: string;
  from?: string;
  to?: string;
  limit?: number;
};

export const meuProgressoKeys = {
  all: ['meu-progresso'] as const,
  exercicio: (params: MeuProgressoParams) =>
    [...meuProgressoKeys.all, 'exercicio', params] as const,
  sugestao: (exercicioId: string) =>
    [...meuProgressoKeys.all, 'sugestao', exercicioId] as const,
};
