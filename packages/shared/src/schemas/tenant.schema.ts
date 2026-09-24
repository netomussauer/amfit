import { z } from 'zod';

// White Label (SDD §20.4). CorPrimaria/CorSecundaria nunca ficam vazias na
// resposta — sem config customizada, o backend devolve os defaults
// (idênticos ao visual atual do app).
// Código de convite do personal (ADR-007, nível 2): 8 caracteres de um
// alfabeto sem ambíguos (sem I, L, O, 0, 1). Mesmo alfabeto do gerador em Go
// (identity/domain/codigo.go) e da migration 000012.
export const CODIGO_CONVITE_REGEX = /^[A-HJKMNP-Z2-9]{8}$/;

// Normaliza o que o aluno digita (espaços, minúsculas) antes de validar/enviar.
export function normalizarCodigoConvite(entrada: string): string {
  return entrada.replace(/\s+/g, '').toUpperCase();
}

export const TenantConfigResponseSchema = z.object({
  logo_url: z.string().url().nullable().optional(),
  cor_primaria: z.string().length(6),
  cor_secundaria: z.string().length(6),
  nome_app: z.string().nullable().optional(),
  // Só vem nas rotas autenticadas do próprio personal (GET /tenants/me/config,
  // PATCH e POST /tenants/me/codigo/regenerar); a resposta do aluno e a
  // pública (GET /public/tenants/:codigo/config) não trazem o código.
  codigo: z.string().regex(CODIGO_CONVITE_REGEX).optional(),
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
