export type AlunoListParams = {
  page: number;
  perPage: number;
  ativo?: boolean;
};

export const alunoKeys = {
  all: ['alunos'] as const,
  lists: () => [...alunoKeys.all, 'list'] as const,
  list: (params: AlunoListParams) => [...alunoKeys.lists(), params] as const,
  details: () => [...alunoKeys.all, 'detail'] as const,
  detail: (id: string) => [...alunoKeys.details(), id] as const,
};
