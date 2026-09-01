import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { ROLES } from '@amfit/shared';
import { useLogin } from '../hooks/useLogin';
import { LoginForm } from './LoginForm';

vi.mock('../hooks/useLogin');

const { mockedReplace, mockedRefresh, mockedUseRouter } = vi.hoisted(() => ({
  mockedReplace: vi.fn(),
  mockedRefresh: vi.fn(),
  mockedUseRouter: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: mockedUseRouter,
}));

const mockedUseLogin = vi.mocked(useLogin);

function mockUseLoginReturn(overrides: Partial<ReturnType<typeof useLogin>>) {
  mockedUseLogin.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useLogin>);
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
  values: { email: string; senha: string },
) {
  await user.type(screen.getByLabelText(/e-mail/i), values.email);
  await user.type(screen.getByLabelText(/senha/i), values.senha);
}

describe('LoginForm', () => {
  beforeEach(() => {
    mockedUseLogin.mockReset();
    mockedReplace.mockReset();
    mockedRefresh.mockReset();
    mockedUseRouter.mockReturnValue({ replace: mockedReplace, refresh: mockedRefresh });
  });

  it('exibe erro de validacao quando o e-mail e invalido', async () => {
    const user = userEvent.setup();
    mockUseLoginReturn({});

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/e-mail/i), 'nao-e-email');
    await user.type(screen.getByLabelText(/senha/i), 'senhaValida123');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('E-mail inválido')).toBeInTheDocument();
  });

  it('exibe erro de validacao quando a senha tem menos de 8 caracteres', async () => {
    const user = userEvent.setup();
    mockUseLoginReturn({});

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/e-mail/i), 'joao@amfit.app');
    await user.type(screen.getByLabelText(/senha/i), '123');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(
      await screen.findByText('Senha deve ter pelo menos 8 caracteres'),
    ).toBeInTheDocument();
  });

  it('envia a mutation com os valores do formulario e o tipo padrao PERSONAL', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseLoginReturn({ mutate });

    render(<LoginForm />);

    await preencherFormulario(user, { email: 'joao@amfit.app', senha: 'senhaValida123' });
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(
      { email: 'joao@amfit.app', senha: 'senhaValida123', tipo: ROLES.PERSONAL },
      expect.anything(),
    );
  });

  it('redireciona para /dashboard quando o login tem sucesso', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_values, opts) => {
      opts.onSuccess(undefined);
    });
    mockUseLoginReturn({ mutate });

    render(<LoginForm />);

    await preencherFormulario(user, { email: 'joao@amfit.app', senha: 'senhaValida123' });
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(mockedReplace).toHaveBeenCalledWith('/dashboard');
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it('exibe mensagem de credenciais invalidas quando a API retorna 401', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_values, opts) => {
      opts.onError(makeAxiosError(401, { detail: 'credenciais inválidas' }));
    });
    mockUseLoginReturn({ mutate });

    render(<LoginForm />);

    await preencherFormulario(user, { email: 'joao@amfit.app', senha: 'senhaErrada12' });
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(
      screen.getByText('E-mail ou senha inválidos. Verifique e tente novamente.'),
    ).toBeInTheDocument();
    expect(mockedReplace).not.toHaveBeenCalled();
  });

  it('exibe mensagem generica quando a API retorna erro inesperado', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_values, opts) => {
      opts.onError(makeAxiosError(500, { detail: 'erro interno' }));
    });
    mockUseLoginReturn({ mutate });

    render(<LoginForm />);

    await preencherFormulario(user, { email: 'joao@amfit.app', senha: 'senhaValida123' });
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(
      screen.getByText('Não foi possível entrar agora. Tente novamente em instantes.'),
    ).toBeInTheDocument();
  });

  it('desabilita o botao de submit enquanto isPending e true', () => {
    mockUseLoginReturn({ isPending: true });

    render(<LoginForm />);

    const button = screen.getByRole('button', { name: /entrando/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
