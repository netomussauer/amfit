import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { useCriarAluno } from '../hooks/useCriarAluno';
import { useAtualizarAluno } from '../hooks/useAtualizarAluno';
import { AlunoForm } from './AlunoForm';

vi.mock('../hooks/useCriarAluno');
vi.mock('../hooks/useAtualizarAluno');

const mockedReplace = vi.fn();
const mockedRefresh = vi.fn();
const mockedBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockedReplace,
    refresh: mockedRefresh,
    back: mockedBack,
  }),
}));

const mockedUseCriarAluno = vi.mocked(useCriarAluno);
const mockedUseAtualizarAluno = vi.mocked(useAtualizarAluno);

function mockUseCriarAlunoReturn(overrides: Partial<ReturnType<typeof useCriarAluno>>) {
  mockedUseCriarAluno.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useCriarAluno>);
}

function mockUseAtualizarAlunoReturn(overrides: Partial<ReturnType<typeof useAtualizarAluno>>) {
  mockedUseAtualizarAluno.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useAtualizarAluno>);
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

describe('AlunoForm — modo create', () => {
  beforeEach(() => {
    mockedUseCriarAluno.mockReset();
    mockedUseAtualizarAluno.mockReset();
    mockedReplace.mockReset();
    mockedRefresh.mockReset();
    mockedBack.mockReset();
    mockUseCriarAlunoReturn({});
  });

  it('renderiza os campos obrigatorios do formulario de cadastro', () => {
    render(<AlunoForm mode="create" />);

    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cadastrar aluno/i })).toBeInTheDocument();
  });

  it('submete os valores preenchidos e navega para /alunos ao ter sucesso', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_values, opts) => {
      opts.onSuccess({ id: 'aluno-1' });
    });
    mockUseCriarAlunoReturn({ mutate });

    render(<AlunoForm mode="create" />);

    await user.type(screen.getByLabelText(/nome completo/i), 'Maria Souza');
    await user.type(screen.getByLabelText(/^e-mail/i), 'maria@aluno.app');
    await user.type(screen.getByLabelText(/^senha/i), 'senhaSegura123');
    await user.click(screen.getByRole('button', { name: /cadastrar aluno/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const [values] = mutate.mock.calls[0];
    expect(values).toMatchObject({
      nome: 'Maria Souza',
      email: 'maria@aluno.app',
      senha: 'senhaSegura123',
    });
    expect(mockedReplace).toHaveBeenCalledWith('/alunos');
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it('exibe erro no campo e-mail quando a API retorna 409', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_values, opts) => {
      opts.onError(makeAxiosError(409, { detail: 'email já cadastrado' }));
    });
    mockUseCriarAlunoReturn({ mutate });

    render(<AlunoForm mode="create" />);

    await user.type(screen.getByLabelText(/nome completo/i), 'Maria Souza');
    await user.type(screen.getByLabelText(/^e-mail/i), 'duplicado@aluno.app');
    await user.type(screen.getByLabelText(/^senha/i), 'senhaSegura123');
    await user.click(screen.getByRole('button', { name: /cadastrar aluno/i }));

    expect(screen.getByText('Este e-mail já está cadastrado')).toBeInTheDocument();
  });

  it('exibe mensagem de erro generica de validacao quando a API retorna 422', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_values, opts) => {
      opts.onError(makeAxiosError(422, { detail: 'validation failed' }));
    });
    mockUseCriarAlunoReturn({ mutate });

    render(<AlunoForm mode="create" />);

    await user.type(screen.getByLabelText(/nome completo/i), 'Maria Souza');
    await user.type(screen.getByLabelText(/^e-mail/i), 'maria@aluno.app');
    await user.type(screen.getByLabelText(/^senha/i), 'senhaSegura123');
    await user.click(screen.getByRole('button', { name: /cadastrar aluno/i }));

    expect(
      screen.getByText('Há campos inválidos no formulário. Revise e tente novamente.'),
    ).toBeInTheDocument();
  });

  it('exibe mensagem de erro generica quando a API retorna outro status', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_values, opts) => {
      opts.onError(makeAxiosError(500, { detail: 'erro interno' }));
    });
    mockUseCriarAlunoReturn({ mutate });

    render(<AlunoForm mode="create" />);

    await user.type(screen.getByLabelText(/nome completo/i), 'Maria Souza');
    await user.type(screen.getByLabelText(/^e-mail/i), 'maria@aluno.app');
    await user.type(screen.getByLabelText(/^senha/i), 'senhaSegura123');
    await user.click(screen.getByRole('button', { name: /cadastrar aluno/i }));

    expect(
      screen.getByText('Não foi possível cadastrar o aluno. Tente novamente.'),
    ).toBeInTheDocument();
  });

  it('chama router.back ao clicar em cancelar', async () => {
    const user = userEvent.setup();
    render(<AlunoForm mode="create" />);

    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(mockedBack).toHaveBeenCalledTimes(1);
  });
});

describe('AlunoForm — modo edit', () => {
  const defaultValues = {
    nome: 'João Silva',
    email: 'joao@aluno.app',
    telefone: '(11) 99999-9999',
    data_nascimento: '2000-05-10',
    sexo: 'M' as const,
  };

  beforeEach(() => {
    mockedUseCriarAluno.mockReset();
    mockedUseAtualizarAluno.mockReset();
    mockedReplace.mockReset();
    mockedRefresh.mockReset();
    mockedBack.mockReset();
    mockUseAtualizarAlunoReturn({});
  });

  it('preenche o formulario com os defaultValues informados', () => {
    render(<AlunoForm mode="edit" alunoId="aluno-1" defaultValues={defaultValues} />);

    expect(screen.getByLabelText(/nome completo/i)).toHaveValue('João Silva');
    expect(screen.getByLabelText(/^e-mail/i)).toHaveValue('joao@aluno.app');
    expect(screen.getByLabelText(/telefone/i)).toHaveValue('(11) 99999-9999');
  });

  it('mantem o submit desabilitado ate o formulario ser alterado', () => {
    render(<AlunoForm mode="edit" alunoId="aluno-1" defaultValues={defaultValues} />);

    expect(screen.getByRole('button', { name: /salvar alterações/i })).toBeDisabled();
  });

  it('submete o payload com id e valores alterados, exibindo mensagem de sucesso', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => {
      opts.onSuccess({ id: 'aluno-1' });
    });
    mockUseAtualizarAlunoReturn({ mutate });

    render(<AlunoForm mode="edit" alunoId="aluno-1" defaultValues={defaultValues} />);

    await user.clear(screen.getByLabelText(/nome completo/i));
    await user.type(screen.getByLabelText(/nome completo/i), 'João Atualizado');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const [vars] = mutate.mock.calls[0];
    expect(vars.id).toBe('aluno-1');
    expect(vars.payload).toMatchObject({ nome: 'João Atualizado' });
    expect(screen.getByRole('status')).toHaveTextContent('Alterações salvas com sucesso.');
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it('exibe erro no campo e-mail quando a API retorna 409', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_vars, opts) => {
      opts.onError(makeAxiosError(409, { detail: 'email já cadastrado' }));
    });
    mockUseAtualizarAlunoReturn({ mutate });

    render(<AlunoForm mode="edit" alunoId="aluno-1" defaultValues={defaultValues} />);

    await user.clear(screen.getByLabelText(/^e-mail/i));
    await user.type(screen.getByLabelText(/^e-mail/i), 'duplicado@aluno.app');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    expect(screen.getByText('Este e-mail já está em uso')).toBeInTheDocument();
  });
});
