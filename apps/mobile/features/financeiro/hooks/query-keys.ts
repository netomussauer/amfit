import type { MinhasMensalidadesQueryParams } from '../services/financeiro.service';

export const financeiroKeys = {
  all: ['meu-financeiro'] as const,
  plano: () => [...financeiroKeys.all, 'plano'] as const,
  mensalidades: (params?: MinhasMensalidadesQueryParams) =>
    [...financeiroKeys.all, 'mensalidades', params ?? {}] as const,
};
