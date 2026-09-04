export const ROLES = {
  PERSONAL: 'PERSONAL',
  ALUNO: 'ALUNO',
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const SESSAO_STATUS = {
  EM_ANDAMENTO: 'EM_ANDAMENTO',
  CONCLUIDO: 'CONCLUIDO',
  ABANDONADO: 'ABANDONADO',
} as const;
export type SessaoStatus = (typeof SESSAO_STATUS)[keyof typeof SESSAO_STATUS];

export const TIPO_MIDIA = {
  VIDEO: 'VIDEO',
  GIF: 'GIF',
  IMAGEM: 'IMAGEM',
} as const;
export type TipoMidia = (typeof TIPO_MIDIA)[keyof typeof TIPO_MIDIA];

// ── Anamnese inteligente (SDD §20.2) ────────────────────────────────
// Nivel apurado a partir do score de scoring da anamnese (0-30 Iniciante,
// 31-60 Intermediario, 61+ Avancado — regra 100% no backend).
export const NIVEL_ANAMNESE = {
  INICIANTE: 'INICIANTE',
  INTERMEDIARIO: 'INTERMEDIARIO',
  AVANCADO: 'AVANCADO',
} as const;
export type NivelAnamnese = (typeof NIVEL_ANAMNESE)[keyof typeof NIVEL_ANAMNESE];

// As 5 chaves abaixo são o contrato estável com o backend (anamnese_scoring.go)
// — nunca enviamos pontos, só a chave da opção escolhida; o backend resolve
// pontos/score/nível a partir dela.
export const ANAMNESE_FREQUENCIA_SEMANAL = {
  SEDENTARIO: 'sedentario',
  UM_A_DOIS_DIAS: '1_2_dias',
  TRES_A_QUATRO_DIAS: '3_4_dias',
  CINCO_MAIS_DIAS: '5_mais_dias',
} as const;
export type AnamneseFrequenciaSemanal =
  (typeof ANAMNESE_FREQUENCIA_SEMANAL)[keyof typeof ANAMNESE_FREQUENCIA_SEMANAL];

export const ANAMNESE_EXPERIENCIA_MESES = {
  NUNCA_TREINEI: 'nunca_treinei',
  MENOS_6_MESES: 'menos_6_meses',
  SEIS_MESES_2_ANOS: '6_meses_2_anos',
  MAIS_2_ANOS: 'mais_2_anos',
} as const;
export type AnamneseExperienciaMeses =
  (typeof ANAMNESE_EXPERIENCIA_MESES)[keyof typeof ANAMNESE_EXPERIENCIA_MESES];

export const ANAMNESE_OBJETIVO = {
  EMAGRECIMENTO: 'emagrecimento',
  CONDICIONAMENTO_GERAL: 'condicionamento_geral',
  HIPERTROFIA: 'hipertrofia',
  PERFORMANCE_FORCA: 'performance_forca',
} as const;
export type AnamneseObjetivo = (typeof ANAMNESE_OBJETIVO)[keyof typeof ANAMNESE_OBJETIVO];

export const ANAMNESE_RESTRICOES = {
  SIM: 'sim',
  NAO: 'nao',
} as const;
export type AnamneseRestricoes = (typeof ANAMNESE_RESTRICOES)[keyof typeof ANAMNESE_RESTRICOES];

export const ANAMNESE_DISPONIBILIDADE = {
  DOIS_DIAS: '2_dias',
  TRES_DIAS: '3_dias',
  QUATRO_A_CINCO_DIAS: '4_5_dias',
} as const;
export type AnamneseDisponibilidade =
  (typeof ANAMNESE_DISPONIBILIDADE)[keyof typeof ANAMNESE_DISPONIBILIDADE];

// ── Notificações push (SDD §13.2) ───────────────────────────────────
export const PLATAFORMA_DISPOSITIVO = {
  ANDROID: 'ANDROID',
  IOS: 'IOS',
} as const;
export type PlataformaDispositivo =
  (typeof PLATAFORMA_DISPOSITIVO)[keyof typeof PLATAFORMA_DISPOSITIVO];
