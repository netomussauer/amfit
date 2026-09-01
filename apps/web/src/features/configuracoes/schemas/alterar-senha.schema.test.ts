import { describe, expect, it } from 'vitest';
import { AlterarSenhaFormSchema } from './alterar-senha.schema';

describe('AlterarSenhaFormSchema', () => {
  it('aceita quando nova_senha e confirmar_nova_senha coincidem', () => {
    const result = AlterarSenhaFormSchema.safeParse({
      senha_atual: 'senhaAntiga123',
      nova_senha: 'senhaNova12345',
      confirmar_nova_senha: 'senhaNova12345',
    });

    expect(result.success).toBe(true);
  });

  it('rejeita quando nova_senha e confirmar_nova_senha nao coincidem, apontando o erro para confirmar_nova_senha', () => {
    const result = AlterarSenhaFormSchema.safeParse({
      senha_atual: 'senhaAntiga123',
      nova_senha: 'senhaNova12345',
      confirmar_nova_senha: 'outraSenha999',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue.path).toEqual(['confirmar_nova_senha']);
      expect(issue.message).toBe('As senhas não coincidem');
    }
  });

  it('rejeita senha_atual com menos de 8 caracteres', () => {
    const result = AlterarSenhaFormSchema.safeParse({
      senha_atual: '1234567',
      nova_senha: 'senhaNova12345',
      confirmar_nova_senha: 'senhaNova12345',
    });

    expect(result.success).toBe(false);
  });

  it('rejeita nova_senha com menos de 8 caracteres', () => {
    const result = AlterarSenhaFormSchema.safeParse({
      senha_atual: 'senhaAntiga123',
      nova_senha: '1234567',
      confirmar_nova_senha: '1234567',
    });

    expect(result.success).toBe(false);
  });
});
