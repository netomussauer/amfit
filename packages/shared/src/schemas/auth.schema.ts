import { z } from 'zod';
import { ROLES } from '../constants';

export const LoginRequestSchema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  tipo: z.enum([ROLES.PERSONAL, ROLES.ALUNO]),
});

export const AuthResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number().int().positive(),
  usuario: z.object({
    id: z.string().uuid(),
    nome: z.string(),
    role: z.enum([ROLES.PERSONAL, ROLES.ALUNO]),
  }),
});
