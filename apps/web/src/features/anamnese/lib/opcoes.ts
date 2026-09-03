import {
  ANAMNESE_FREQUENCIA_SEMANAL,
  ANAMNESE_EXPERIENCIA_MESES,
  ANAMNESE_OBJETIVO,
  ANAMNESE_RESTRICOES,
  ANAMNESE_DISPONIBILIDADE,
  NIVEL_ANAMNESE,
  type AnamneseFrequenciaSemanal,
  type AnamneseExperienciaMeses,
  type AnamneseObjetivo,
  type AnamneseRestricoes,
  type AnamneseDisponibilidade,
  type NivelAnamnese,
} from '@amfit/shared';

type Opcao<T extends string> = { value: T; label: string };

// Labels exibidos nos <select> do formulário de scoring (SDD §20.2) — os
// mesmos labels que o backend resolve e devolve em `respostas.*.opcao`
// (anamnese_scoring.go é a fonte de verdade). Mudar o texto aqui não afeta
// o cálculo do score: o valor enviado ao backend é sempre a chave (`value`).
export const OPCOES_FREQUENCIA_SEMANAL: Opcao<AnamneseFrequenciaSemanal>[] = [
  { value: ANAMNESE_FREQUENCIA_SEMANAL.SEDENTARIO, label: 'Nenhuma (sedentário)' },
  { value: ANAMNESE_FREQUENCIA_SEMANAL.UM_A_DOIS_DIAS, label: '1-2 dias/semana' },
  { value: ANAMNESE_FREQUENCIA_SEMANAL.TRES_A_QUATRO_DIAS, label: '3-4 dias/semana' },
  { value: ANAMNESE_FREQUENCIA_SEMANAL.CINCO_MAIS_DIAS, label: '5+ dias/semana' },
];

export const OPCOES_EXPERIENCIA_MESES: Opcao<AnamneseExperienciaMeses>[] = [
  { value: ANAMNESE_EXPERIENCIA_MESES.NUNCA_TREINEI, label: 'Nunca treinei' },
  { value: ANAMNESE_EXPERIENCIA_MESES.MENOS_6_MESES, label: 'Menos de 6 meses' },
  { value: ANAMNESE_EXPERIENCIA_MESES.SEIS_MESES_2_ANOS, label: '6 meses a 2 anos' },
  { value: ANAMNESE_EXPERIENCIA_MESES.MAIS_2_ANOS, label: 'Mais de 2 anos' },
];

export const OPCOES_OBJETIVO_SCORING: Opcao<AnamneseObjetivo>[] = [
  { value: ANAMNESE_OBJETIVO.EMAGRECIMENTO, label: 'Emagrecimento' },
  { value: ANAMNESE_OBJETIVO.CONDICIONAMENTO_GERAL, label: 'Condicionamento geral' },
  { value: ANAMNESE_OBJETIVO.HIPERTROFIA, label: 'Hipertrofia' },
  { value: ANAMNESE_OBJETIVO.PERFORMANCE_FORCA, label: 'Performance/força' },
];

export const OPCOES_RESTRICOES: Opcao<AnamneseRestricoes>[] = [
  { value: ANAMNESE_RESTRICOES.SIM, label: 'Sim (limitam exercícios)' },
  { value: ANAMNESE_RESTRICOES.NAO, label: 'Não' },
];

export const OPCOES_DISPONIBILIDADE: Opcao<AnamneseDisponibilidade>[] = [
  { value: ANAMNESE_DISPONIBILIDADE.DOIS_DIAS, label: '2 dias' },
  { value: ANAMNESE_DISPONIBILIDADE.TRES_DIAS, label: '3 dias' },
  { value: ANAMNESE_DISPONIBILIDADE.QUATRO_A_CINCO_DIAS, label: '4-5 dias' },
];

export const NIVEL_ANAMNESE_LABEL: Record<NivelAnamnese, string> = {
  [NIVEL_ANAMNESE.INICIANTE]: 'Iniciante',
  [NIVEL_ANAMNESE.INTERMEDIARIO]: 'Intermediário',
  [NIVEL_ANAMNESE.AVANCADO]: 'Avançado',
};

// Mesmo padrão de badge "pill" usado no restante do app (ex: status
// ativo/inativo em AlunoDetalhe): fundo suave + texto na cor semântica.
export const NIVEL_ANAMNESE_BADGE_CLASS: Record<NivelAnamnese, string> = {
  [NIVEL_ANAMNESE.INICIANTE]: 'bg-slate-100 text-[--color-text-muted]',
  [NIVEL_ANAMNESE.INTERMEDIARIO]: 'bg-amber-50 text-[--color-warning]',
  [NIVEL_ANAMNESE.AVANCADO]: 'bg-green-50 text-[--color-success]',
};
