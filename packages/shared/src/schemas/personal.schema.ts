import { z } from 'zod';

export const AtualizarPersonalRequestSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(150).optional(),
  email: z.string().email('E-mail inválido').optional(),
  telefone: z
    .string()
    .max(20, 'Telefone deve ter no máximo 20 caracteres')
    .optional()
    .or(z.literal('')),
  cref: z
    .string()
    .max(20, 'CREF deve ter no máximo 20 caracteres')
    .optional()
    .or(z.literal('')),
});

export const PersonalResponseSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  email: z.string().email(),
  telefone: z.string().nullable().optional(),
  cref: z.string().nullable().optional(),
  ativo: z.boolean(),
  criado_em: z.string().datetime(),
});

export const AlterarSenhaRequestSchema = z.object({
  senha_atual: z.string().min(8, 'Senha atual deve ter pelo menos 8 caracteres'),
  nova_senha: z.string().min(8, 'Nova senha deve ter pelo menos 8 caracteres'),
});

// Types inferidos sao exportados centralmente em ../types/index.ts
// para evitar conflito de re-export em src/index.ts.
