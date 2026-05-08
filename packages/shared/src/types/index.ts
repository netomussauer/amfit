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

// Sessao
export type RegistrarSerieRequest = z.infer<typeof RegistrarSerieRequestSchema>;
export type RegistroSerieResponse = z.infer<typeof RegistroSerieResponseSchema>;
export type SessaoResponse = z.infer<typeof SessaoResponseSchema>;
export type TreinoHojeResponse = z.infer<typeof TreinoHojeResponseSchema>;
export type SessaoResumoResponse = z.infer<typeof SessaoResumoResponseSchema>;
export type SessaoListResponse = z.infer<typeof SessaoListResponseSchema>;
export type IniciarSessaoRequest = z.infer<typeof IniciarSessaoRequestSchema>;
