import { z } from 'zod';

const SexoEnum = z.enum(['M', 'F', 'OUTRO']);
const SexoFormField = z.union([SexoEnum, z.literal('')]).optional();

export const CriarAlunoRequestSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  telefone: z
    .string()
    .max(20, 'Telefone deve ter no máximo 20 caracteres')
    .optional()
    .or(z.literal('')),
  data_nascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .optional()
    .or(z.literal('')),
  sexo: SexoFormField,
});

export const AtualizarAlunoRequestSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
  email: z.string().email('E-mail inválido').optional(),
  telefone: z
    .string()
    .max(20, 'Telefone deve ter no máximo 20 caracteres')
    .optional()
    .or(z.literal('')),
  data_nascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .optional()
    .or(z.literal('')),
  sexo: SexoFormField,
});

export const AlunoResponseSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  email: z.string().email(),
  telefone: z.string().nullable().optional(),
  data_nascimento: z.string().nullable().optional(),
  sexo: SexoEnum.nullable().optional(),
  ativo: z.boolean(),
  criado_em: z.string().datetime(),
  atualizado_em: z.string().datetime().optional(),
});

export const AlunoListResponseSchema = z.object({
  data: z.array(AlunoResponseSchema),
  pagination: z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    per_page: z.number().int().positive(),
  }),
});
