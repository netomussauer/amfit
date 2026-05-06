import { z } from 'zod';
import { SESSAO_STATUS } from '../constants';
import { TreinoResponseSchema } from './ficha.schema';

const SessaoStatusEnum = z.enum([
  SESSAO_STATUS.EM_ANDAMENTO,
  SESSAO_STATUS.CONCLUIDO,
  SESSAO_STATUS.ABANDONADO,
]);

export const RegistrarSerieRequestSchema = z.object({
  item_treino_id: z.string().uuid('ID do item de treino inválido'),
  numero_serie: z.number().int().min(1, 'Número da série deve ser pelo menos 1'),
  concluida: z.boolean(),
  carga_realizada: z.number().nullable().optional(),
  repeticoes_realizadas: z.number().int().nonnegative().nullable().optional(),
});

export const RegistroSerieResponseSchema = z.object({
  id: z.string().uuid(),
  item_treino_id: z.string().uuid(),
  numero_serie: z.number().int().positive(),
  concluida: z.boolean(),
  carga_realizada: z.number().nullable().optional(),
  repeticoes_realizadas: z.number().int().nonnegative().nullable().optional(),
  executado_em: z.string().datetime(),
});

export const SessaoResponseSchema = z.object({
  id: z.string().uuid(),
  treino_id: z.string().uuid(),
  data_execucao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: SessaoStatusEnum,
  iniciado_em: z.string().datetime(),
  concluido_em: z.string().datetime().nullable().optional(),
  series: z.array(RegistroSerieResponseSchema),
});

export const TreinoHojeResponseSchema = z.object({
  treino: TreinoResponseSchema,
  sessao_hoje_id: z.string().uuid().nullable().optional(),
});
