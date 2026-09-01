import { z } from 'zod';
import { AlterarSenhaRequestSchema } from '@amfit/shared';

// `confirmar_nova_senha` existe apenas no formulário (validação client-side de
// que as senhas digitadas coincidem) e nunca é enviado à API — o payload
// enviado ao service usa apenas os campos de `AlterarSenhaRequestSchema`.
export const AlterarSenhaFormSchema = AlterarSenhaRequestSchema.extend({
  confirmar_nova_senha: z.string().min(8, 'Confirme a nova senha'),
}).refine((data) => data.nova_senha === data.confirmar_nova_senha, {
  message: 'As senhas não coincidem',
  path: ['confirmar_nova_senha'],
});

export type AlterarSenhaFormValues = z.infer<typeof AlterarSenhaFormSchema>;
