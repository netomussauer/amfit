export const treinoKeys = {
  all: ['treino'] as const,
  hoje: () => [...treinoKeys.all, 'hoje'] as const,
};

export const fichaKeys = {
  all: ['minha-ficha'] as const,
  ativa: () => [...fichaKeys.all, 'ativa'] as const,
};
