import { z } from 'zod';
import { TIPO_MIDIA } from '../constants';

const TipoMidiaEnum = z.enum([TIPO_MIDIA.VIDEO, TIPO_MIDIA.GIF, TIPO_MIDIA.IMAGEM]);

export const GrupoMuscularSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
});

export const ExercicioResponseSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  descricao: z.string().nullable().optional(),
  grupo_muscular: GrupoMuscularSchema,
  midia_url: z.string().url().nullable().optional(),
  tipo_midia: TipoMidiaEnum.nullable().optional(),
  is_global: z.boolean(),
});

export const CriarExercicioRequestSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  grupo_muscular_id: z.string().uuid('ID do grupo muscular inválido'),
  descricao: z.string().optional(),
});
