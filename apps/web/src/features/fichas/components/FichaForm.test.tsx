import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { useCriarFicha } from '../hooks/useCriarFicha';
import { useAtualizarFicha } from '../hooks/useAtualizarFicha';
import { FichaForm } from './FichaForm';

vi.mock('../hooks/useCriarFicha');
vi.mock('../hooks/useAtualizarFicha');

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

const mockedUseCriarFicha = vi.mocked(useCriarFicha);
const mockedUseAtualizarFicha = vi.mocked(useAtualizarFicha);

function mockUseCriarFichaReturn(overrides: Partial<ReturnType<typeof useCriarFicha>>) {
  mockedUseCriarFicha.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useCriarFicha>);
}

function mockUseAtualizarFichaReturn(overrides: Partial<ReturnType<typeof useAtualizarFicha>>) {
  mockedUseAtualizarFicha.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useAtualizarFicha>);
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

describe('FichaForm — modo create', () => {
  beforeEach(() => {
    mockedUseCriarFicha.mockReset();
    mockedUseAtualizarFicha.mockReset();
    mockedReplace.mockReset();
    mockedRefresh.mockReset();
    mockedBack.mockReset();
    mockUseCriarFichaReturn({});
  });

  it('renderiza os campos do formulario de criacao com aluno_id preenchido via campo oculto', () => {
    render(<FichaForm mode="create" alunoId="11111111-1111-1111-1111-111111111111" />);

    expect(screen.getByLabelText(/nome da ficha/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/vigência \(início\)/i)).toHaveValue(today());
    expect(screen.getByRole('button', { name: /criar ficha/i })).toBeInTheDocument();
  });

  it('submete os valores e navega para a ficha criada ao ter sucesso', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_values, opts) => {
      opts.onSuccess({ id: 'ficha-1' });
    });
    mockUseCriarFichaReturn({ mutate });

    render(<FichaForm mode="create" alunoId="11111111-1111-1111-1111-111111111111" />);

    await user.type(screen.getByLabelText(/nome da ficha/i), 'Hipertrofia — Maio/2026');
    await user.click(screen.getByRole('button', { name: /criar ficha/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const [values] = mutate.mock.calls[0];
    expect(values).toMatchObject({
      aluno_id: '11111111-1111-1111-1111-111111111111',
      nome: 'Hipertrofia — Maio/2026',
      vigencia_inicio: today(),
    });
    expect(mockedReplace).toHaveBeenCalledWith('/alunos/11111111-1111-1111-1111-111111111111/fichas/ficha-1');
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it('exibe mensagem de erro quando a API retorna 404 (aluno nao encontrado)', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_values, opts) => {
      opts.onError(makeAxiosError(404, { detail: 'aluno não encontrado' }));
    });
    mockUseCriarFichaReturn({ mutate });

    render(<FichaForm mode="create" alunoId="11111111-1111-1111-1111-111111111111" />);

    await user.type(screen.getByLabelText(/nome da ficha/i), 'Ficha X');
    await user.click(screen.getByRole('button', { name: /criar ficha/i }));

    expect(screen.getByText('Aluno não encontrado.')).toBeInTheDocument();
  });

  it('exibe mensagem de erro de validacao quando a API retorna 422', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_values, opts) => {
      opts.onError(makeAxiosError(422, { detail: 'validation failed' }));
    });
    mockUseCriarFichaReturn({ mutate });

    render(<FichaForm mode="create" alunoId="11111111-1111-1111-1111-111111111111" />);

    await user.type(screen.getByLabelText(/nome da ficha/i), 'Ficha X');
    await user.click(screen.getByRole('button', { name: /criar ficha/i }));

    expect(
      screen.getByText('Há campos inválidos no formulário. Revise e tente novamente.'),
    ).toBeInTheDocument();
  });

  it('chama onCancel customizado (em vez de router.back) quando informado', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<FichaForm mode="create" alunoId="11111111-1111-1111-1111-111111111111" onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mockedBack).not.toHaveBeenCalled();
  });
});

describe('FichaForm — modo edit', () => {
  const defaultValues = {
    nome: 'Hipertrofia — Maio/2026',
    vigencia_inicio: '2026-05-01',
    vigencia_fim: '',
    ativa: true,
  };

  beforeEach(() => {
    mockedUseCriarFicha.mockReset();
    mockedUseAtualizarFicha.mockReset();
    mockedReplace.mockReset();
    mockedRefresh.mockReset();
    mockedBack.mockReset();
    mockUseAtualizarFichaReturn({});
  });

  it('preenche o formulario com os defaultValues informados', () => {
    render(
      <FichaForm
        mode="edit"
        alunoId="11111111-1111-1111-1111-111111111111"
        fichaId="ficha-1"
        defaultValues={defaultValues}
      />,
    );

    expect(screen.getByLabelText(/nome da ficha/i)).toHaveValue('Hipertrofia — Maio/2026');
    expect(screen.getByLabelText(/vigência \(início\)/i)).toHaveValue('2026-05-01');
    expect(screen.getByLabelText(/ficha ativa/i)).toBeChecked();
  });

  it('mantem o submit desabilitado ate o formulario ser alterado', () => {
    render(
      <FichaForm
        mode="edit"
        alunoId="11111111-1111-1111-1111-111111111111"
        fichaId="ficha-1"
        defaultValues={defaultValues}
      />,
    );

    expect(screen.getByRole('button', { name: /salvar alterações/i })).toBeDisabled();
  });

  it('submete o payload com id e chama onSaved apos sucesso', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const mutate = vi.fn((_vars, opts) => {
      opts.onSuccess({ id: 'ficha-1' });
    });
    mockUseAtualizarFichaReturn({ mutate });

    render(
      <FichaForm
        mode="edit"
        alunoId="11111111-1111-1111-1111-111111111111"
        fichaId="ficha-1"
        defaultValues={defaultValues}
        onSaved={onSaved}
      />,
    );

    await user.clear(screen.getByLabelText(/nome da ficha/i));
    await user.type(screen.getByLabelText(/nome da ficha/i), 'Nome atualizado');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const [vars] = mutate.mock.calls[0];
    expect(vars.id).toBe('ficha-1');
    expect(vars.payload).toMatchObject({ nome: 'Nome atualizado' });
    expect(screen.getByRole('status')).toHaveTextContent('Alterações salvas com sucesso.');
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
});

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
