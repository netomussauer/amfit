export const sessaoKeys = {
  all: ['sessoes'] as const,
  detail: (id: string) => [...sessaoKeys.all, 'detail', id] as const,
};

export const minhasSessoesKeys = {
  all: ['minhas-sessoes'] as const,
  list: (page: number, perPage: number) =>
    [...minhasSessoesKeys.all, 'list', { page, perPage }] as const,
};
