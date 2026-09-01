import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { useAlterarSenha } from '../hooks/useAlterarSenha';
import { AlterarSenhaForm } from './AlterarSenhaForm';

vi.mock('../hooks/useAlterarSenha');

const mockedUseAlterarSenha = vi.mocked(useAlterarSenha);

function mockUseAlterarSenhaReturn(overrides: Partial<ReturnType<typeof useAlterarSenha>>) {
  mockedUseAlterarSenha.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useAlterarSenha>);
}

function makeAxiosError(status: number, data: unknown) {
  const error = new AxiosError('erro');
  error.response = {
    status,
    data,
    statusText: '',
    headers: {},
    // @ts-expect-error -- config nao e relevante para este teste
    config: {},
  };
  return error;
}

async function preencherFormulario(
  user: ReturnType<typeof userEvent.setup>,
  values: { senhaAtual: string; novaSenha: string; confirmarNovaSenha: string },
) {
  await user.type(screen.getByLabelText(/senha atual/i), values.senhaAtual);
  await user.type(screen.getByLabelText(/^nova senha/i), values.novaSenha);
  await user.type(screen.getByLabelText(/confirmar nova senha/i), values.confirmarNovaSenha);
}

describe('AlterarSenhaForm', () => {
  beforeEach(() => {
    mockedUseAlterarSenha.mockReset();
  });

  it('envia a mutation e exibe mensagem de sucesso quando a senha e alterada', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_values, opts) => {
      opts.onSuccess(undefined);
    });
    mockUseAlterarSenhaReturn({ mutate });

    render(<AlterarSenhaForm />);

    await preencherFormulario(user, {
      senhaAtual: 'senhaAntiga123',
      novaSenha: 'senhaNova12345',
      confirmarNovaSenha: 'senhaNova12345',
    });
    await user.click(screen.getByRole('button', { name: /alterar senha/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(
      { senha_atual: 'senhaAntiga123', nova_senha: 'senhaNova12345' },
      expect.anything(),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Senha alterada com sucesso.');
  });

  it('exibe o erro no campo senha_atual quando a API retorna 422 de senha atual incorreta', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_values, opts) => {
      opts.onError(makeAxiosError(422, { detail: 'senha atual incorreta' }));
    });
    mockUseAlterarSenhaReturn({ mutate });

    render(<AlterarSenhaForm />);

    await preencherFormulario(user, {
      senhaAtual: 'senhaErrada12',
      novaSenha: 'senhaNova12345',
      confirmarNovaSenha: 'senhaNova12345',
    });
    await user.click(screen.getByRole('button', { name: /alterar senha/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const senhaAtualInput = screen.getByLabelText(/senha atual/i);
    expect(senhaAtualInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Senha atual incorreta.')).toBeInTheDocument();
  });

  it('bloqueia o submit no client quando nova_senha e confirmar_nova_senha nao coincidem', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseAlterarSenhaReturn({ mutate });

    render(<AlterarSenhaForm />);

    await preencherFormulario(user, {
      senhaAtual: 'senhaAntiga123',
      novaSenha: 'senhaNova12345',
      confirmarNovaSenha: 'senhaDiferente99',
    });
    await user.click(screen.getByRole('button', { name: /alterar senha/i }));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText('As senhas não coincidem')).toBeInTheDocument();
  });
});
