import { z } from 'zod';
import { ROLES } from '../constants';

export const LoginRequestSchema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  tipo: z.enum([ROLES.PERSONAL, ROLES.ALUNO]),
});

export const RegisterPersonalRequestSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(150),
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
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

export const RefreshTokenRequestSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token obrigatório'),
});

export const AuthResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string(),
  expires_in: z.number().int().positive(),
  usuario: z.object({
    id: z.string().uuid(),
    nome: z.string(),
    role: z.enum([ROLES.PERSONAL, ROLES.ALUNO]),
  }),
});
