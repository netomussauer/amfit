import { z } from 'zod';
import { LoginRequestSchema, AuthResponseSchema } from '../schemas/auth.schema';
import {
  CriarAlunoRequestSchema,
  AlunoResponseSchema,
  AlunoListResponseSchema,
} from '../schemas/aluno.schema';
import {
  GrupoMuscularSchema,
  ExercicioResponseSchema,
  CriarExercicioRequestSchema,
} from '../schemas/exercicio.schema';
import {
  ItemTreinoResponseSchema,
  TreinoResponseSchema,
  FichaResponseSchema,
  CriarFichaRequestSchema,
} from '../schemas/ficha.schema';
import {
  RegistrarSerieRequestSchema,
  RegistroSerieResponseSchema,
  SessaoResponseSchema,
  TreinoHojeResponseSchema,
} from '../schemas/sessao.schema';

// Auth
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// Aluno
export type CriarAlunoRequest = z.infer<typeof CriarAlunoRequestSchema>;
export type AlunoResponse = z.infer<typeof AlunoResponseSchema>;
export type AlunoListResponse = z.infer<typeof AlunoListResponseSchema>;

// Exercicio
export type GrupoMuscular = z.infer<typeof GrupoMuscularSchema>;
export type ExercicioResponse = z.infer<typeof ExercicioResponseSchema>;
export type CriarExercicioRequest = z.infer<typeof CriarExercicioRequestSchema>;

// Ficha
export type ItemTreinoResponse = z.infer<typeof ItemTreinoResponseSchema>;
export type TreinoResponse = z.infer<typeof TreinoResponseSchema>;
export type FichaResponse = z.infer<typeof FichaResponseSchema>;
export type CriarFichaRequest = z.infer<typeof CriarFichaRequestSchema>;

// Sessao
export type RegistrarSerieRequest = z.infer<typeof RegistrarSerieRequestSchema>;
export type RegistroSerieResponse = z.infer<typeof RegistroSerieResponseSchema>;
export type SessaoResponse = z.infer<typeof SessaoResponseSchema>;
export type TreinoHojeResponse = z.infer<typeof TreinoHojeResponseSchema>;
