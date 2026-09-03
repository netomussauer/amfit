import { z } from 'zod';
import {
  NIVEL_ANAMNESE,
  ANAMNESE_FREQUENCIA_SEMANAL,
  ANAMNESE_EXPERIENCIA_MESES,
  ANAMNESE_OBJETIVO,
  ANAMNESE_RESTRICOES,
  ANAMNESE_DISPONIBILIDADE,
} from '../constants';

const NivelAnamneseEnum = z.enum([
  NIVEL_ANAMNESE.INICIANTE,
  NIVEL_ANAMNESE.INTERMEDIARIO,
  NIVEL_ANAMNESE.AVANCADO,
]);

// As 5 perguntas padronizadas de scoring (SDD §20.2). Cada uma é um select
// obrigatório — o valor enviado é sempre a *chave* da opção (nunca pontos
// nem o label), resolvida pelo backend contra anamnese_scoring.go.
const FrequenciaSemanalEnum = z.enum(
  [
    ANAMNESE_FREQUENCIA_SEMANAL.SEDENTARIO,
    ANAMNESE_FREQUENCIA_SEMANAL.UM_A_DOIS_DIAS,
    ANAMNESE_FREQUENCIA_SEMANAL.TRES_A_QUATRO_DIAS,
    ANAMNESE_FREQUENCIA_SEMANAL.CINCO_MAIS_DIAS,
  ],
  { errorMap: () => ({ message: 'Selecione a frequência de treino atual' }) },
);

const ExperienciaMesesEnum = z.enum(
  [
    ANAMNESE_EXPERIENCIA_MESES.NUNCA_TREINEI,
    ANAMNESE_EXPERIENCIA_MESES.MENOS_6_MESES,
    ANAMNESE_EXPERIENCIA_MESES.SEIS_MESES_2_ANOS,
    ANAMNESE_EXPERIENCIA_MESES.MAIS_2_ANOS,
  ],
  { errorMap: () => ({ message: 'Selecione a experiência com treino' }) },
);

const ObjetivoScoringEnum = z.enum(
  [
    ANAMNESE_OBJETIVO.EMAGRECIMENTO,
    ANAMNESE_OBJETIVO.CONDICIONAMENTO_GERAL,
    ANAMNESE_OBJETIVO.HIPERTROFIA,
    ANAMNESE_OBJETIVO.PERFORMANCE_FORCA,
  ],
  { errorMap: () => ({ message: 'Selecione o objetivo principal' }) },
);

const RestricoesEnum = z.enum([ANAMNESE_RESTRICOES.SIM, ANAMNESE_RESTRICOES.NAO], {
  errorMap: () => ({ message: 'Informe se há restrições médicas' }),
});

const DisponibilidadeEnum = z.enum(
  [
    ANAMNESE_DISPONIBILIDADE.DOIS_DIAS,
    ANAMNESE_DISPONIBILIDADE.TRES_DIAS,
    ANAMNESE_DISPONIBILIDADE.QUATRO_A_CINCO_DIAS,
  ],
  { errorMap: () => ({ message: 'Selecione a disponibilidade semanal' }) },
);

export const AnamneseRespostasRequestSchema = z.object({
  frequencia_semanal: FrequenciaSemanalEnum,
  experiencia_meses: ExperienciaMesesEnum,
  objetivo: ObjetivoScoringEnum,
  restricoes: RestricoesEnum,
  disponibilidade: DisponibilidadeEnum,
});

// POST /alunos/:alunoId/anamnese — upsert (mesmo payload para criar e para
// reavaliar). O backend calcula score/nível/sugestão de template a partir
// de `respostas`; os demais campos são texto livre/opcionais.
export const RegistrarAnamneseRequestSchema = z.object({
  objetivo: z
    .string()
    .min(2, 'Objetivo deve ter pelo menos 2 caracteres')
    .max(200, 'Objetivo deve ter no máximo 200 caracteres'),
  lesoes: z.string().max(1000, 'Máximo de 1000 caracteres').optional().or(z.literal('')),
  doencas_preexistentes: z
    .string()
    .max(1000, 'Máximo de 1000 caracteres')
    .optional()
    .or(z.literal('')),
  medicamentos: z.string().max(1000, 'Máximo de 1000 caracteres').optional().or(z.literal('')),
  pratica_outro_esporte: z.boolean(),
  outro_esporte: z.string().max(200, 'Máximo de 200 caracteres').optional().or(z.literal('')),
  frequencia_semanas_anterior: z
    .number({ invalid_type_error: 'Informe um número de dias' })
    .int('Deve ser um número inteiro')
    .min(0, 'Mínimo de 0 dias')
    .max(7, 'Máximo de 7 dias')
    .optional(),
  observacoes_gerais: z
    .string()
    .max(2000, 'Máximo de 2000 caracteres')
    .optional()
    .or(z.literal('')),
  respostas: AnamneseRespostasRequestSchema,
});

export const RespostaAnamneseResponseSchema = z.object({
  opcao: z.string(),
  pontos: z.number().int(),
});

export const RespostasAnamneseResponseSchema = z.object({
  frequencia_semanal: RespostaAnamneseResponseSchema,
  experiencia_meses: RespostaAnamneseResponseSchema,
  objetivo: RespostaAnamneseResponseSchema,
  restricoes: RespostaAnamneseResponseSchema,
  disponibilidade: RespostaAnamneseResponseSchema,
});

// GET e POST /alunos/:alunoId/anamnese devolvem o mesmo shape.
// `template_ficha_id`/`template_ficha_nome` só vêm preenchidos na resposta
// do POST (a sugestão é calculada ali) — no GET vêm sempre ausentes, o que
// é esperado, não um bug.
export const AnamneseResponseSchema = z.object({
  id: z.string().uuid(),
  aluno_id: z.string().uuid(),
  objetivo: z.string(),
  lesoes: z.string().nullable().optional(),
  doencas_preexistentes: z.string().nullable().optional(),
  medicamentos: z.string().nullable().optional(),
  pratica_outro_esporte: z.boolean(),
  outro_esporte: z.string().nullable().optional(),
  frequencia_semanas_anterior: z.number().int().nullable().optional(),
  observacoes_gerais: z.string().nullable().optional(),
  respostas: RespostasAnamneseResponseSchema,
  score_calculado: z.number().int(),
  nivel_sugerido: NivelAnamneseEnum,
  template_ficha_id: z.string().uuid().nullable().optional(),
  template_ficha_nome: z.string().nullable().optional(),
  preenchido_em: z.string().datetime(),
  atualizado_em: z.string().datetime(),
});

// Types inferidos sao exportados centralmente em ../types/index.ts
// para evitar conflito de re-export em src/index.ts.
