export const personalKeys = {
  all: ['personal'] as const,
  me: () => [...personalKeys.all, 'me'] as const,
};
