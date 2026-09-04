import { z } from 'zod';

export const StatusPlanoEnum = z.enum(['ATIVO', 'SUSPENSO', 'ENCERRADO']);
export const StatusMensalidadeEnum = z.enum([
  'PENDENTE',
  'PAGA',
  'ATRASADA',
  'CANCELADA',
  'ISENTA',
]);
export const FormaPagamentoEnum = z.enum(['PIX', 'BOLETO', 'CARTAO', 'DINHEIRO']);

export const CriarPlanoRequestSchema = z.object({
  valor_mensal: z.coerce.number().positive('Valor deve ser maior que zero'),
  dia_vencimento: z.coerce
    .number()
    .int()
    .min(1, 'Dia deve estar entre 1 e 28')
    .max(28, 'Dia deve estar entre 1 e 28'),
  vigencia_inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .optional()
    .or(z.literal('')),
  observacao: z.string().max(500).optional().or(z.literal('')),
});

export const AtualizarPlanoRequestSchema = z.object({
  valor_mensal: z.coerce.number().positive('Valor deve ser maior que zero').optional(),
  dia_vencimento: z.coerce
    .number()
    .int()
    .min(1, 'Dia deve estar entre 1 e 28')
    .max(28, 'Dia deve estar entre 1 e 28')
    .optional(),
  vigencia_fim: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .optional()
    .or(z.literal('')),
  status: StatusPlanoEnum.optional(),
  observacao: z.string().max(500).optional().or(z.literal('')),
});

export const PlanoResponseSchema = z.object({
  id: z.string().uuid(),
  aluno_id: z.string().uuid(),
  valor_mensal: z.number(),
  dia_vencimento: z.number().int(),
  vigencia_inicio: z.string(),
  vigencia_fim: z.string().nullable().optional(),
  status: StatusPlanoEnum,
  observacao: z.string().nullable().optional(),
  criado_em: z.string().datetime(),
  atualizado_em: z.string().datetime(),
});

export const MarcarPagaRequestSchema = z.object({
  valor_pago: z.coerce.number().positive('Valor deve ser maior que zero').optional(),
  data_pagamento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .optional()
    .or(z.literal('')),
  forma_pagamento: FormaPagamentoEnum,
  observacao: z.string().max(500).optional().or(z.literal('')),
});

export const AtualizarStatusMensalidadeRequestSchema = z.object({
  status: z.enum(['CANCELADA', 'ISENTA']),
  observacao: z.string().max(500).optional().or(z.literal('')),
});

export const MensalidadeResponseSchema = z.object({
  id: z.string().uuid(),
  plano_id: z.string().uuid(),
  aluno_id: z.string().uuid(),
  competencia_ano: z.number().int(),
  competencia_mes: z.number().int(),
  data_vencimento: z.string(),
  valor: z.number(),
  status: StatusMensalidadeEnum,
  valor_pago: z.number().nullable().optional(),
  data_pagamento: z.string().nullable().optional(),
  forma_pagamento: FormaPagamentoEnum.nullable().optional(),
  observacao: z.string().nullable().optional(),
  criado_em: z.string().datetime(),
  atualizado_em: z.string().datetime(),
});

export const MensalidadeListResponseSchema = z.object({
  data: z.array(MensalidadeResponseSchema),
  pagination: z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    per_page: z.number().int().positive(),
  }),
});

export const AlunoInadimplenteSchema = z.object({
  aluno_id: z.string().uuid(),
  nome: z.string(),
  qtd_atrasadas: z.number().int(),
  valor_total_atrasado: z.number(),
});

export const DashboardFinanceiroResponseSchema = z.object({
  mensalidades_pendentes: z.object({ qtd: z.number().int(), valor: z.number() }),
  mensalidades_atrasadas: z.object({ qtd: z.number().int(), valor: z.number() }),
  receita_mes_atual: z.number(),
  inadimplentes: z.array(AlunoInadimplenteSchema),
});
