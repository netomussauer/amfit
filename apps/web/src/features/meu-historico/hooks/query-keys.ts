export type MinhasSessoesParams = {
  page: number;
  perPage: number;
};

export const minhaSessaoKeys = {
  all: ['minhas-sessoes'] as const,
  lists: () => [...minhaSessaoKeys.all, 'list'] as const,
  list: (params: MinhasSessoesParams) => [...minhaSessaoKeys.lists(), params] as const,
  details: () => [...minhaSessaoKeys.all, 'detail'] as const,
  detail: (id: string) => [...minhaSessaoKeys.details(), id] as const,
};
