export const meuPerfilKeys = {
  all: ['meu-perfil'] as const,
  detail: () => [...meuPerfilKeys.all, 'detail'] as const,
};
