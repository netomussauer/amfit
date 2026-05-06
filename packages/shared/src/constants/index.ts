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
