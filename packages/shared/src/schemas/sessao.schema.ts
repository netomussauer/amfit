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
  numero_serie: z
    .number()
    .int()
    .min(1, 'Número da série deve ser pelo menos 1')
    .max(20, 'Número da série não pode exceder 20'),
  concluida: z.boolean(),
  carga_realizada: z.number().nonnegative().nullable().optional(),
  repeticoes_realizadas: z
    .number()
    .int()
    .nonnegative()
    .max(200, 'Repetições inválidas')
    .nullable()
    .optional(),
});

export const RegistroSerieResponseSchema = z.object({
  id: z.string().uuid(),
  item_treino_id: z.string().uuid(),
  numero_serie: z.number().int().positive(),
  concluida: z.boolean(),
  carga_realizada: z.number().nullable().optional(),
  repeticoes_realizadas: z.number().int().nonnegative().nullable().optional(),
  // Só preenchido quando concluida=true (Execution registra o instante).
  executado_em: z.string().datetime().nullable().optional(),
});

export const SessaoResponseSchema = z.object({
  id: z.string().uuid(),
  treino_id: z.string().uuid(),
  data_execucao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: SessaoStatusEnum,
  iniciado_em: z.string().datetime(),
  concluido_em: z.string().datetime().nullable().optional(),
  series: z.array(RegistroSerieResponseSchema),
  /**
   * Treino executado, populado pelo backend no GET /sessoes/:id para que
   * o consumidor possa renderizar nomes de exercício, grupo muscular,
   * cargas sugeridas etc. sem outra requisição.
   */
  treino: TreinoResponseSchema.optional(),
});

export const TreinoHojeResponseSchema = z.object({
  treino: TreinoResponseSchema,
  sessao_hoje_id: z.string().uuid().nullable().optional(),
});

// ── Histórico de Sessões ─────────────────────────────────────────────

export const SessaoResumoResponseSchema = z.object({
  id: z.string().uuid(),
  treino_id: z.string().uuid(),
  treino_letra: z.string(),
  treino_nome: z.string().optional().nullable(),
  data_execucao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: SessaoStatusEnum,
  iniciado_em: z.string().datetime(),
  concluido_em: z.string().datetime().nullable().optional(),
  total_series: z.number().int().nonnegative(),
  series_concluidas: z.number().int().nonnegative(),
});

export const SessaoListResponseSchema = z.object({
  data: z.array(SessaoResumoResponseSchema),
  pagination: z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    per_page: z.number().int().positive(),
  }),
});

export const IniciarSessaoRequestSchema = z.object({
  treino_id: z.string().uuid('ID do treino inválido'),
});
