export type FichaListParams = {
  aluno_id?: string;
  ativa?: boolean;
};

export const fichaKeys = {
  all: ['fichas'] as const,
  lists: () => [...fichaKeys.all, 'list'] as const,
  list: (params: FichaListParams) => [...fichaKeys.lists(), params] as const,
  byAluno: (alunoId: string) =>
    [...fichaKeys.lists(), { aluno_id: alunoId }] as const,
  details: () => [...fichaKeys.all, 'detail'] as const,
  detail: (id: string) => [...fichaKeys.details(), id] as const,
};
