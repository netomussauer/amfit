import { z } from 'zod';
import { ExercicioResponseSchema } from './exercicio.schema';

export const ItemTreinoResponseSchema = z.object({
  id: z.string().uuid(),
  ordem: z.number().int().nonnegative(),
  exercicio: ExercicioResponseSchema,
  series: z.number().int().positive(),
  repeticoes: z.string(),
  carga_sugerida: z.number().nullable().optional(),
  descanso_segundos: z.number().int().nonnegative().nullable().optional(),
  observacao: z.string().nullable().optional(),
});

export const TreinoResponseSchema = z.object({
  id: z.string().uuid(),
  letra: z.string(),
  nome: z.string().nullable().optional(),
  ordem: z.number().int().nonnegative(),
  itens: z.array(ItemTreinoResponseSchema),
});

export const FichaResponseSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  aluno_id: z.string().uuid(),
  vigencia_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vigencia_fim: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  ativa: z.boolean(),
  treinos: z.array(TreinoResponseSchema),
});

export const CriarFichaRequestSchema = z.object({
  aluno_id: z.string().uuid('ID do aluno inválido'),
  nome: z.string().min(1, 'Nome é obrigatório'),
  vigencia_inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  vigencia_fim: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .optional(),
});
