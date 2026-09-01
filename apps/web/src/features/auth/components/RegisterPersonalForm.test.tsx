import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { useRegisterPersonal } from '../hooks/useRegisterPersonal';
import { RegisterPersonalForm } from './RegisterPersonalForm';

vi.mock('../hooks/useRegisterPersonal');

const { mockedReplace, mockedRefresh, mockedUseRouter } = vi.hoisted(() => ({
  mockedReplace: vi.fn(),
  mockedRefresh: vi.fn(),
  mockedUseRouter: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: mockedUseRouter,
}));

const mockedUseRegisterPersonal = vi.mocked(useRegisterPersonal);

function mockUseRegisterPersonalReturn(
  overrides: Partial<ReturnType<typeof useRegisterPersonal>>,
) {
  mockedUseRegisterPersonal.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useRegisterPersonal>);
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
  values: { nome: string; email: string; senha: string },
) {
  await user.type(screen.getByLabelText(/nome completo/i), values.nome);
  await user.type(screen.getByLabelText(/e-mail/i), values.email);
  await user.type(screen.getByLabelText(/^senha/i), values.senha);
}

describe('RegisterPersonalForm', () => {
  beforeEach(() => {
    mockedUseRegisterPersonal.mockReset();
    mockedReplace.mockReset();
    mockedRefresh.mockReset();
    mockedUseRouter.mockReturnValue({ replace: mockedReplace, refresh: mockedRefresh });
  });

  it('exibe erros de validacao quando campos obrigatorios sao invalidos', async () => {
    const user = userEvent.setup();
    mockUseRegisterPersonalReturn({});

    render(<RegisterPersonalForm />);

    await user.type(screen.getByLabelText(/nome completo/i), 'A');
    await user.type(screen.getByLabelText(/e-mail/i), 'nao-e-email');
    await user.type(screen.getByLabelText(/^senha/i), '123');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(
      await screen.findByText('Nome deve ter pelo menos 2 caracteres'),
    ).toBeInTheDocument();
    expect(screen.getByText('E-mail inválido')).toBeInTheDocument();
    expect(screen.getByText('Senha deve ter pelo menos 8 caracteres')).toBeInTheDocument();
  });

  it('envia a mutation com os valores preenchidos (telefone/cref vazios permitidos pelo schema)', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseRegisterPersonalReturn({ mutate });

    render(<RegisterPersonalForm />);

    await preencherFormulario(user, {
      nome: 'João Silva',
      email: 'joao@amfit.app',
      senha: 'senhaValida123',
    });
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(
      {
        nome: 'João Silva',
        email: 'joao@amfit.app',
        senha: 'senhaValida123',
        telefone: '',
        cref: '',
      },
      expect.anything(),
    );
  });

  it('redireciona para /dashboard quando o cadastro tem sucesso', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_values, opts) => {
      opts.onSuccess(undefined);
    });
    mockUseRegisterPersonalReturn({ mutate });

    render(<RegisterPersonalForm />);

    await preencherFormulario(user, {
      nome: 'João Silva',
      email: 'joao@amfit.app',
      senha: 'senhaValida123',
    });
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(mockedReplace).toHaveBeenCalledWith('/dashboard');
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it('exibe o erro de e-mail duplicado no campo de e-mail quando a API retorna 409', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_values, opts) => {
      opts.onError(makeAxiosError(409, { detail: 'email já cadastrado' }));
    });
    mockUseRegisterPersonalReturn({ mutate });

    render(<RegisterPersonalForm />);

    await preencherFormulario(user, {
      nome: 'João Silva',
      email: 'duplicado@amfit.app',
      senha: 'senhaValida123',
    });
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    const emailInput = screen.getByLabelText(/e-mail/i);
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Este e-mail já está cadastrado')).toBeInTheDocument();
    expect(mockedReplace).not.toHaveBeenCalled();
  });

  it('exibe mensagem generica de campos invalidos quando a API retorna 422', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_values, opts) => {
      opts.onError(makeAxiosError(422, { detail: 'validation failed' }));
    });
    mockUseRegisterPersonalReturn({ mutate });

    render(<RegisterPersonalForm />);

    await preencherFormulario(user, {
      nome: 'João Silva',
      email: 'joao@amfit.app',
      senha: 'senhaValida123',
    });
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(
      screen.getByText('Há campos inválidos no formulário. Revise e tente novamente.'),
    ).toBeInTheDocument();
  });

  it('exibe mensagem generica quando a API retorna erro inesperado', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_values, opts) => {
      opts.onError(makeAxiosError(500, { detail: 'erro interno' }));
    });
    mockUseRegisterPersonalReturn({ mutate });

    render(<RegisterPersonalForm />);

    await preencherFormulario(user, {
      nome: 'João Silva',
      email: 'joao@amfit.app',
      senha: 'senhaValida123',
    });
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(
      screen.getByText('Não foi possível concluir o cadastro. Tente novamente.'),
    ).toBeInTheDocument();
  });

  it('desabilita o botao de submit enquanto isPending e true', () => {
    mockUseRegisterPersonalReturn({ isPending: true });

    render(<RegisterPersonalForm />);

    const button = screen.getByRole('button', { name: /cadastrando/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
