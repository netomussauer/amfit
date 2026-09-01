export const execucaoSessaoKeys = {
  all: ['execucao-sessao'] as const,
  detail: (id: string) => [...execucaoSessaoKeys.all, 'detail', id] as const,
};

export const minhasSessoesKeys = {
  all: ['minhas-sessoes'] as const,
  list: (page: number, perPage: number) =>
    [...minhasSessoesKeys.all, 'list', { page, perPage }] as const,
};
