import { z } from 'zod';
import { TIPO_MIDIA } from '../constants';

const TipoMidiaEnum = z.enum([TIPO_MIDIA.VIDEO, TIPO_MIDIA.GIF, TIPO_MIDIA.IMAGEM]);

export const GrupoMuscularSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
});

// Endpoint GET /grupos-musculares retorna array direto (sem wrapper de paginacao).
export const GrupoMuscularListResponseSchema = z.array(GrupoMuscularSchema);

export const ExercicioResponseSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  descricao: z.string().nullable().optional(),
  grupo_muscular: GrupoMuscularSchema,
  midia_url: z.string().url().nullable().optional(),
  tipo_midia: TipoMidiaEnum.nullable().optional(),
  is_global: z.boolean(),
});

export const ExercicioListResponseSchema = z.object({
  data: z.array(ExercicioResponseSchema),
});

export const CriarExercicioRequestSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(150),
  grupo_muscular_id: z.string().uuid('ID do grupo muscular inválido'),
  descricao: z.string().max(2000).optional(),
});

export const AtualizarExercicioRequestSchema = z.object({
  nome: z.string().min(2).max(150).optional(),
  grupo_muscular_id: z.string().uuid('ID do grupo muscular inválido').optional(),
  descricao: z.string().max(2000).optional().or(z.literal('')),
});

export type GrupoMuscular = z.infer<typeof GrupoMuscularSchema>;
export type GrupoMuscularListResponse = z.infer<typeof GrupoMuscularListResponseSchema>;
export type ExercicioResponse = z.infer<typeof ExercicioResponseSchema>;
export type ExercicioListResponse = z.infer<typeof ExercicioListResponseSchema>;
export type CriarExercicioRequest = z.infer<typeof CriarExercicioRequestSchema>;
export type AtualizarExercicioRequest = z.infer<typeof AtualizarExercicioRequestSchema>;
