import { z } from 'zod';

// ── Progresso / Evolução de Carga ───────────────────────────────────

export const PontoProgressoResponseSchema = z.object({
  sessao_id: z.string().uuid(),
  data_execucao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  numero_serie: z.number().int().positive(),
  carga_realizada: z.number().nullable().optional(),
  repeticoes_realizadas: z.number().int().nonnegative().nullable().optional(),
});

export const HistoricoExercicioResponseSchema = z.object({
  aluno_id: z.string().uuid(),
  exercicio_id: z.string().uuid(),
  pontos: z.array(PontoProgressoResponseSchema),
});

// Query params opcionais aceitos por ambos os endpoints de histórico
// (GET /alunos/me/progresso/exercicio/:exercicioId e
// GET /alunos/:alunoId/progresso/exercicio/:exercicioId).
export const HistoricoExercicioQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .optional(),
  limit: z.number().int().positive().optional(),
});

// ── Sugestão de Progressão (Progressive Overload) ────────────────────
// GET /alunos/me/progresso/exercicio/:exercicioId/sugestao (+ variante
// /alunos/:alunoId/... para o personal). Comparação auto-referencial das
// duas últimas sessões concluídas do exercício — sem depender da meta de
// repetições da ficha (texto livre, não comparável numericamente).

export const SugestaoProgressaoResponseSchema = z.object({
  exercicio_id: z.string().uuid(),
  tem_sugestao: z.boolean(),
  direcao: z.enum(['AUMENTAR', 'MANTER']).optional(),
  carga_sugerida: z.number().optional(),
  ultima_carga_registrada: z.number().optional(),
  ultima_media_repeticoes: z.number().optional(),
});

// ── Dashboard do Personal ────────────────────────────────────────────

export const DashboardResponseSchema = z.object({
  alunos_ativos: z.number().int().nonnegative(),
  fichas_ativas: z.number().int().nonnegative(),
  sessoes_ultimos_7_dias: z.number().int().nonnegative(),
  sessoes_ultimos_30_dias: z.number().int().nonnegative(),
  alunos_sem_sessao_7_dias: z.number().int().nonnegative(),
});

// Types inferidos sao exportados centralmente em ../types/index.ts
// para evitar conflito de re-export em src/index.ts.
