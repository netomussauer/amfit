export const personalKeys = {
  all: ['personal'] as const,
  me: () => [...personalKeys.all, 'me'] as const,
};

export const tenantKeys = {
  all: ['tenant'] as const,
  me: () => [...tenantKeys.all, 'me'] as const,
};
