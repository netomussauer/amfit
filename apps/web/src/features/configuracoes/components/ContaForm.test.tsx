import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { PersonalResponse } from '@amfit/shared';
import { useMinhaConta } from '../hooks/useMinhaConta';
import { useAtualizarConta } from '../hooks/useAtualizarConta';
import { ContaForm } from './ContaForm';

vi.mock('../hooks/useMinhaConta');
vi.mock('../hooks/useAtualizarConta');

const mockedUseMinhaConta = vi.mocked(useMinhaConta);
const mockedUseAtualizarConta = vi.mocked(useAtualizarConta);

const contaFixture: PersonalResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  nome: 'João Personal',
  email: 'joao@amfit.app',
  telefone: '(11) 99999-9999',
  cref: '000000-G/SP',
  ativo: true,
  criado_em: '2026-05-11T16:46:15Z',
};

function mockUseMinhaContaReturn(overrides: Partial<ReturnType<typeof useMinhaConta>>) {
  mockedUseMinhaConta.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useMinhaConta>);
}

function mockUseAtualizarContaReturn(
  overrides: Partial<ReturnType<typeof useAtualizarConta>>,
) {
  mockedUseAtualizarConta.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useAtualizarConta>);
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

describe('ContaForm', () => {
  beforeEach(() => {
    mockedUseMinhaConta.mockReset();
    mockedUseAtualizarConta.mockReset();
    mockUseAtualizarContaReturn({});
  });

  it('exibe mensagem de carregamento enquanto isLoading e true', () => {
    mockUseMinhaContaReturn({ isLoading: true });

    render(<ContaForm />);

    expect(screen.getByText('Carregando seus dados...')).toBeInTheDocument();
  });

  it('exibe erro com botao de retry quando isError e true', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseMinhaContaReturn({ isError: true, refetch });

    render(<ContaForm />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar seus dados.');

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('preenche o formulario com os dados da conta carregada', () => {
    mockUseMinhaContaReturn({ data: contaFixture });

    render(<ContaForm />);

    expect(screen.getByLabelText(/nome completo/i)).toHaveValue('João Personal');
    expect(screen.getByLabelText(/^e-mail/i)).toHaveValue('joao@amfit.app');
    expect(screen.getByLabelText(/telefone/i)).toHaveValue('(11) 99999-9999');
    expect(screen.getByLabelText(/cref/i)).toHaveValue('000000-G/SP');
    expect(
      screen.getByText(/este e-mail também é usado para fazer login/i),
    ).toBeInTheDocument();
  });

  it('exibe mensagem de sucesso apos salvar as alteracoes', async () => {
    const user = userEvent.setup();
    mockUseMinhaContaReturn({ data: contaFixture });
    const mutate = vi.fn((_values, opts) => {
      opts.onSuccess({ ...contaFixture, nome: 'João Atualizado' });
    });
    mockUseAtualizarContaReturn({ mutate });

    render(<ContaForm />);

    await user.clear(screen.getByLabelText(/nome completo/i));
    await user.type(screen.getByLabelText(/nome completo/i), 'João Atualizado');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Alterações salvas com sucesso.');
  });

  it('exibe o erro de e-mail duplicado no campo de e-mail quando a API retorna 409', async () => {
    const user = userEvent.setup();
    mockUseMinhaContaReturn({ data: contaFixture });
    const mutate = vi.fn((_values, opts) => {
      opts.onError(makeAxiosError(409, { detail: 'email já cadastrado' }));
    });
    mockUseAtualizarContaReturn({ mutate });

    render(<ContaForm />);

    await user.clear(screen.getByLabelText(/^e-mail/i));
    await user.type(screen.getByLabelText(/^e-mail/i), 'duplicado@amfit.app');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const emailInput = screen.getByLabelText(/^e-mail/i);
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('email já cadastrado')).toBeInTheDocument();
  });

  it('exibe erros de validacao por campo quando a API retorna 422 com errors[]', async () => {
    const user = userEvent.setup();
    mockUseMinhaContaReturn({ data: contaFixture });
    const mutate = vi.fn((_values, opts) => {
      opts.onError(
        makeAxiosError(422, {
          detail: 'validation failed',
          // Erro de formato que so o backend valida (nao ha regex client-side
          // para telefone) — garante que o submit chegue ao mutate em vez de
          // ser bloqueado pelo zodResolver antes da chamada.
          errors: [{ field: 'telefone', message: 'Telefone em formato inválido' }],
        }),
      );
    });
    mockUseAtualizarContaReturn({ mutate });

    render(<ContaForm />);

    await user.clear(screen.getByLabelText(/telefone/i));
    await user.type(screen.getByLabelText(/telefone/i), '11999999999');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Telefone em formato inválido')).toBeInTheDocument();
    expect(
      screen.getByText('Há campos inválidos no formulário. Revise e tente novamente.'),
    ).toBeInTheDocument();
  });
});
