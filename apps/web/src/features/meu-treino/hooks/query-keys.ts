export const treinoHojeKeys = {
  all: ['treino-hoje'] as const,
  hoje: () => [...treinoHojeKeys.all, 'hoje'] as const,
};

export const minhaFichaKeys = {
  all: ['minha-ficha'] as const,
  ativa: () => [...minhaFichaKeys.all, 'ativa'] as const,
};
