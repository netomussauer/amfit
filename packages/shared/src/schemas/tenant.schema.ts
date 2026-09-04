import { z } from 'zod';

// White Label (SDD §20.4). CorPrimaria/CorSecundaria nunca ficam vazias na
// resposta — sem config customizada, o backend devolve os defaults
// (idênticos ao visual atual do app).
export const TenantConfigResponseSchema = z.object({
  logo_url: z.string().url().nullable().optional(),
  cor_primaria: z.string().length(6),
  cor_secundaria: z.string().length(6),
  nome_app: z.string().nullable().optional(),
});

// Campos de texto de PATCH /tenants/me/config — o logo (opcional) é
// enviado à parte, fora do JSON, porque o corpo real é
// multipart/form-data (ver AtualizarTenantConfigRequest no backend).
export const AtualizarTenantConfigRequestSchema = z.object({
  cor_primaria: z
    .string()
    .regex(/^[0-9a-fA-F]{6}$/, 'Cor deve ser um hexadecimal de 6 dígitos (sem #)')
    .optional(),
  cor_secundaria: z
    .string()
    .regex(/^[0-9a-fA-F]{6}$/, 'Cor deve ser um hexadecimal de 6 dígitos (sem #)')
    .optional(),
  nome_app: z.string().max(100).optional().or(z.literal('')),
});
