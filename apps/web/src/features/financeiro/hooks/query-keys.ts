export type MensalidadeListParams = {
  alunoId?: string;
  status?: string;
  competenciaAno?: number;
  competenciaMes?: number;
  page: number;
  perPage: number;
};

export const financeiroKeys = {
  all: ['financeiro'] as const,
  plano: (alunoId: string) => [...financeiroKeys.all, 'plano', alunoId] as const,
  mensalidades: () => [...financeiroKeys.all, 'mensalidades'] as const,
  mensalidadeList: (params: MensalidadeListParams) =>
    [...financeiroKeys.mensalidades(), params] as const,
  dashboard: () => [...financeiroKeys.all, 'dashboard'] as const,
};
