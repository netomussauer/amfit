import { z } from 'zod';
import {
  LoginRequestSchema,
  RegisterPersonalRequestSchema,
  RefreshTokenRequestSchema,
  AuthResponseSchema,
} from '../schemas/auth.schema';
import {
  CriarAlunoRequestSchema,
  AtualizarAlunoRequestSchema,
  AlunoResponseSchema,
  AlunoListResponseSchema,
} from '../schemas/aluno.schema';
import {
  AtualizarPersonalRequestSchema,
  PersonalResponseSchema,
  AlterarSenhaRequestSchema,
} from '../schemas/personal.schema';
import {
  GrupoMuscularSchema,
  ExercicioResponseSchema,
  ExercicioListResponseSchema,
  CriarExercicioRequestSchema,
  AtualizarExercicioRequestSchema,
} from '../schemas/exercicio.schema';
import {
  ItemTreinoResponseSchema,
  TreinoResponseSchema,
  FichaResponseSchema,
  FichaListResponseSchema,
  CriarFichaRequestSchema,
  AtualizarFichaRequestSchema,
  CriarTreinoRequestSchema,
  AtualizarTreinoRequestSchema,
  CriarItemTreinoRequestSchema,
  AtualizarItemTreinoRequestSchema,
  ReordenarItensRequestSchema,
  CriarFichaFromTemplateRequestSchema,
} from '../schemas/ficha.schema';
import {
  RegistrarSerieRequestSchema,
  RegistroSerieResponseSchema,
  SessaoResponseSchema,
  TreinoHojeResponseSchema,
  SessaoResumoResponseSchema,
  SessaoListResponseSchema,
  IniciarSessaoRequestSchema,
} from '../schemas/sessao.schema';
import {
  PontoProgressoResponseSchema,
  HistoricoExercicioResponseSchema,
  HistoricoExercicioQuerySchema,
  SugestaoProgressaoResponseSchema,
  DashboardResponseSchema,
} from '../schemas/progresso.schema';
import {
  AnamneseRespostasRequestSchema,
  RegistrarAnamneseRequestSchema,
  RespostaAnamneseResponseSchema,
  RespostasAnamneseResponseSchema,
  AnamneseResponseSchema,
} from '../schemas/anamnese.schema';
import { RegistrarPushTokenRequestSchema } from '../schemas/notificacao.schema';

// Auth
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type RegisterPersonalRequest = z.infer<typeof RegisterPersonalRequestSchema>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// Aluno
export type CriarAlunoRequest = z.infer<typeof CriarAlunoRequestSchema>;
export type AtualizarAlunoRequest = z.infer<typeof AtualizarAlunoRequestSchema>;
export type AlunoResponse = z.infer<typeof AlunoResponseSchema>;
export type AlunoListResponse = z.infer<typeof AlunoListResponseSchema>;

// Personal
export type AtualizarPersonalRequest = z.infer<typeof AtualizarPersonalRequestSchema>;
export type PersonalResponse = z.infer<typeof PersonalResponseSchema>;
export type AlterarSenhaRequest = z.infer<typeof AlterarSenhaRequestSchema>;

// Exercicio
export type GrupoMuscular = z.infer<typeof GrupoMuscularSchema>;
export type ExercicioResponse = z.infer<typeof ExercicioResponseSchema>;
export type ExercicioListResponse = z.infer<typeof ExercicioListResponseSchema>;
export type CriarExercicioRequest = z.infer<typeof CriarExercicioRequestSchema>;
export type AtualizarExercicioRequest = z.infer<typeof AtualizarExercicioRequestSchema>;

// Ficha
export type ItemTreinoResponse = z.infer<typeof ItemTreinoResponseSchema>;
export type TreinoResponse = z.infer<typeof TreinoResponseSchema>;
export type FichaResponse = z.infer<typeof FichaResponseSchema>;
export type FichaListResponse = z.infer<typeof FichaListResponseSchema>;
export type CriarFichaRequest = z.infer<typeof CriarFichaRequestSchema>;
export type AtualizarFichaRequest = z.infer<typeof AtualizarFichaRequestSchema>;
export type CriarTreinoRequest = z.infer<typeof CriarTreinoRequestSchema>;
export type AtualizarTreinoRequest = z.infer<typeof AtualizarTreinoRequestSchema>;
export type CriarItemTreinoRequest = z.infer<typeof CriarItemTreinoRequestSchema>;
export type AtualizarItemTreinoRequest = z.infer<typeof AtualizarItemTreinoRequestSchema>;
export type ReordenarItensRequest = z.infer<typeof ReordenarItensRequestSchema>;
export type CriarFichaFromTemplateRequest = z.infer<typeof CriarFichaFromTemplateRequestSchema>;

// Sessao
export type RegistrarSerieRequest = z.infer<typeof RegistrarSerieRequestSchema>;
export type RegistroSerieResponse = z.infer<typeof RegistroSerieResponseSchema>;
export type SessaoResponse = z.infer<typeof SessaoResponseSchema>;
export type TreinoHojeResponse = z.infer<typeof TreinoHojeResponseSchema>;
export type SessaoResumoResponse = z.infer<typeof SessaoResumoResponseSchema>;
export type SessaoListResponse = z.infer<typeof SessaoListResponseSchema>;
export type IniciarSessaoRequest = z.infer<typeof IniciarSessaoRequestSchema>;

// Progresso
export type PontoProgressoResponse = z.infer<typeof PontoProgressoResponseSchema>;
export type HistoricoExercicioResponse = z.infer<typeof HistoricoExercicioResponseSchema>;
export type HistoricoExercicioQuery = z.infer<typeof HistoricoExercicioQuerySchema>;
export type SugestaoProgressaoResponse = z.infer<typeof SugestaoProgressaoResponseSchema>;
export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;

// Anamnese
export type AnamneseRespostasRequest = z.infer<typeof AnamneseRespostasRequestSchema>;
export type RegistrarAnamneseRequest = z.infer<typeof RegistrarAnamneseRequestSchema>;
export type RespostaAnamneseResponse = z.infer<typeof RespostaAnamneseResponseSchema>;
export type RespostasAnamneseResponse = z.infer<typeof RespostasAnamneseResponseSchema>;
export type AnamneseResponse = z.infer<typeof AnamneseResponseSchema>;

// Notificações
export type RegistrarPushTokenRequest = z.infer<typeof RegistrarPushTokenRequestSchema>;
