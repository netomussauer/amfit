import { z } from 'zod';
import { ExercicioResponseSchema } from './exercicio.schema';

const dataIsoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD');

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
  vigencia_inicio: dataIsoSchema,
  vigencia_fim: dataIsoSchema.nullable().optional(),
  ativa: z.boolean(),
  treinos: z.array(TreinoResponseSchema),
});

export const FichaListResponseSchema = z.object({
  data: z.array(FichaResponseSchema),
});

// ── Ficha ────────────────────────────────────────────────────────────

// Limites alinhados com o validator do backend (apps/api/.../dto.go).

export const CriarFichaRequestSchema = z.object({
  aluno_id: z.string().uuid('ID do aluno inválido'),
  nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(150, 'Nome muito longo'),
  vigencia_inicio: dataIsoSchema,
  vigencia_fim: dataIsoSchema.optional().or(z.literal('')),
});

export const AtualizarFichaRequestSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(150).optional(),
  vigencia_inicio: dataIsoSchema.optional(),
  vigencia_fim: dataIsoSchema.optional().or(z.literal('')),
  ativa: z.boolean().optional(),
});

// ── Treino ───────────────────────────────────────────────────────────

export const CriarTreinoRequestSchema = z.object({
  letra: z
    .string()
    .min(1, 'Letra é obrigatória')
    .max(2, 'Letra deve ter no máximo 2 caracteres'),
  nome: z.string().max(100).optional().or(z.literal('')),
  ordem: z.number().int().nonnegative('Ordem inválida'),
});

export const AtualizarTreinoRequestSchema = z.object({
  letra: z.string().min(1).max(2).optional(),
  nome: z.string().max(100).optional().or(z.literal('')),
  ordem: z.number().int().nonnegative().optional(),
});

// ── Item de Treino ───────────────────────────────────────────────────

export const CriarItemTreinoRequestSchema = z.object({
  exercicio_id: z.string().uuid('Selecione um exercício'),
  ordem: z.number().int().nonnegative(),
  series: z
    .number({ invalid_type_error: 'Informe o número de séries' })
    .int('Séries deve ser inteiro')
    .min(1, 'Mínimo de 1 série')
    .max(20, 'Máximo de 20 séries'),
  repeticoes: z.string().min(1, 'Informe as repetições').max(50),
  carga_sugerida: z
    .number({ invalid_type_error: 'Carga inválida' })
    .nonnegative('Carga deve ser positiva')
    .nullable()
    .optional(),
  descanso_segundos: z
    .number({ invalid_type_error: 'Descanso inválido' })
    .int('Descanso deve ser inteiro')
    .min(0, 'Descanso deve ser positivo')
    .max(600, 'Descanso máximo é 600s')
    .nullable()
    .optional(),
  observacao: z.string().max(500).nullable().optional(),
});

export const AtualizarItemTreinoRequestSchema = z.object({
  series: z.number().int().min(1).max(20).optional(),
  repeticoes: z.string().min(1).max(50).optional(),
  carga_sugerida: z.number().nonnegative().nullable().optional(),
  descanso_segundos: z.number().int().min(0).max(600).nullable().optional(),
  observacao: z.string().max(500).nullable().optional(),
  ordem: z.number().int().nonnegative().optional(),
});

export const ReordenarItensRequestSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'Lista de itens vazia'),
});

// Types inferidos sao exportados centralmente em ../types/index.ts
// para evitar conflito de re-export em src/index.ts.
