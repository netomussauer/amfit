import { z } from 'zod';
import { PLATAFORMA_DISPOSITIVO } from '../constants';

// POST /push-token — registro (upsert) de um token Expo Push. Backend
// nunca devolve corpo (204 No Content) nem aceita owner_id/owner_tipo no
// payload — resolve isso do JWT autenticado.
export const RegistrarPushTokenRequestSchema = z.object({
  token: z.string().min(1, 'Token obrigatório'),
  plataforma: z.enum([PLATAFORMA_DISPOSITIVO.ANDROID, PLATAFORMA_DISPOSITIVO.IOS]),
});
