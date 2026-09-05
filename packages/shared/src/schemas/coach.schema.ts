import { z } from 'zod';

export const StatusCoachVideoEnum = z.enum([
  'AGUARDANDO_FEEDBACK',
  'FEEDBACK_ENVIADO',
  'ARQUIVADO',
]);

export const EnviarFeedbackRequestSchema = z.object({
  texto: z.string().min(1, 'Escreva um feedback').max(2000),
});

export const CoachVideoFeedbackResponseSchema = z.object({
  texto: z.string(),
  enviado_em: z.string().datetime(),
});

export const CoachVideoResponseSchema = z.object({
  id: z.string().uuid(),
  aluno_id: z.string().uuid(),
  aluno_nome: z.string().optional(),
  item_treino_id: z.string().uuid().nullable().optional(),
  exercicio_nome: z.string().nullable().optional(),
  video_url: z.string(),
  duracao_segundos: z.number().int(),
  status: StatusCoachVideoEnum,
  descricao: z.string().nullable().optional(),
  criado_em: z.string().datetime(),
  feedback: CoachVideoFeedbackResponseSchema.nullable().optional(),
});

export const CoachVideoListResponseSchema = z.object({
  data: z.array(CoachVideoResponseSchema),
  pagination: z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    per_page: z.number().int().positive(),
  }),
});
