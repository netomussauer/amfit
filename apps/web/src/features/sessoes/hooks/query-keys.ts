export type SessoesPorAlunoParams = {
  alunoId: string;
  page: number;
  perPage: number;
};

export const sessaoKeys = {
  all: ['sessoes'] as const,
  lists: () => [...sessaoKeys.all, 'list'] as const,
  byAluno: (params: SessoesPorAlunoParams) =>
    [...sessaoKeys.lists(), params] as const,
  details: () => [...sessaoKeys.all, 'detail'] as const,
  detail: (id: string) => [...sessaoKeys.details(), id] as const,
};
