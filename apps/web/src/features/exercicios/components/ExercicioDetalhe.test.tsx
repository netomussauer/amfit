import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { ExercicioResponse } from '@amfit/shared';
import { useExercicio } from '../hooks/useExercicio';
import { useDesativarExercicio } from '../hooks/useDesativarExercicio';
import { ExercicioDetalhe } from './ExercicioDetalhe';

vi.mock('../hooks/useExercicio');
vi.mock('../hooks/useDesativarExercicio');

const { mockedReplace, mockedRefresh, mockedUseRouter } = vi.hoisted(() => ({
  mockedReplace: vi.fn(),
  mockedRefresh: vi.fn(),
  mockedUseRouter: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: mockedUseRouter,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ExercicioForm tem cobertura propria (ExercicioForm.test.tsx) e depende de
// mais hooks (useGruposMusculares, useAtualizarExercicio); substitui por um
// stub para isolar o teste de ExercicioDetalhe.
vi.mock('./ExercicioForm', () => ({
  ExercicioForm: ({ readOnly }: { readOnly?: boolean }) => (
    <div data-testid="exercicio-form-mock">{readOnly ? 'form somente leitura' : 'form editável'}</div>
  ),
}));

const mockedUseExercicio = vi.mocked(useExercicio);
const mockedUseDesativarExercicio = vi.mocked(useDesativarExercicio);

function mockExercicioReturn(overrides: Partial<ReturnType<typeof useExercicio>>) {
  mockedUseExercicio.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useExercicio>);
}

function mockDesativarReturn(overrides: Partial<ReturnType<typeof useDesativarExercicio>>) {
  mockedUseDesativarExercicio.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useDesativarExercicio>);
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

const exercicioFixture: ExercicioResponse = {
  id: '22222222-2222-2222-2222-222222222222',
  nome: 'Supino reto',
  descricao: 'Instruções',
  grupo_muscular: { id: '11111111-1111-1111-1111-111111111111', nome: 'Peito' },
  midia_url: null,
  tipo_midia: null,
  is_global: false,
};

describe('ExercicioDetalhe', () => {
  beforeEach(() => {
    mockedUseExercicio.mockReset();
    mockedUseDesativarExercicio.mockReset();
    mockedReplace.mockReset();
    mockedRefresh.mockReset();
    mockedUseRouter.mockReturnValue({ replace: mockedReplace, refresh: mockedRefresh });
    mockDesativarReturn({});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('exibe mensagem de carregamento enquanto isLoading e true', () => {
    mockExercicioReturn({ isLoading: true });

    render(<ExercicioDetalhe exercicioId={exercicioFixture.id} />);

    expect(screen.getByText('Carregando exercício...')).toBeInTheDocument();
  });

  it('exibe erro com botao de retry quando isError e true', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockExercicioReturn({ isError: true, refetch });

    render(<ExercicioDetalhe exercicioId={exercicioFixture.id} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar este exercício.',
    );

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renderiza nome, grupo muscular e o form em modo editavel para exercicio nao-global', () => {
    mockExercicioReturn({ data: exercicioFixture });

    render(<ExercicioDetalhe exercicioId={exercicioFixture.id} />);

    expect(screen.getByRole('heading', { name: 'Supino reto' })).toBeInTheDocument();
    expect(screen.getByText('Peito')).toBeInTheDocument();
    expect(screen.getByTestId('exercicio-form-mock')).toHaveTextContent('form editável');
    expect(screen.getByRole('button', { name: /remover exercício/i })).toBeInTheDocument();
  });

  it('renderiza o form em modo somente leitura e oculta o botao de remover para exercicio global', () => {
    mockExercicioReturn({ data: { ...exercicioFixture, is_global: true } });

    render(<ExercicioDetalhe exercicioId={exercicioFixture.id} />);

    expect(screen.getByText('Global')).toBeInTheDocument();
    expect(screen.getByTestId('exercicio-form-mock')).toHaveTextContent('form somente leitura');
    expect(screen.queryByRole('button', { name: /remover exercício/i })).not.toBeInTheDocument();
  });

  it('remove o exercicio apos confirmacao e redireciona para /exercicios', async () => {
    const user = userEvent.setup();
    const desativar = vi.fn((_id, opts) => {
      opts.onSuccess(undefined);
    });
    mockExercicioReturn({ data: exercicioFixture });
    mockDesativarReturn({ mutate: desativar });

    render(<ExercicioDetalhe exercicioId={exercicioFixture.id} />);

    await user.click(screen.getByRole('button', { name: /remover exercício/i }));

    expect(window.confirm).toHaveBeenCalledWith(
      'Tem certeza que deseja remover "Supino reto"? Esta ação não pode ser desfeita.',
    );
    expect(desativar).toHaveBeenCalledWith(exercicioFixture.id, expect.anything());
    expect(mockedReplace).toHaveBeenCalledWith('/exercicios');
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it('nao chama a mutation quando a confirmacao e cancelada', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const desativar = vi.fn();
    mockExercicioReturn({ data: exercicioFixture });
    mockDesativarReturn({ mutate: desativar });

    render(<ExercicioDetalhe exercicioId={exercicioFixture.id} />);

    await user.click(screen.getByRole('button', { name: /remover exercício/i }));

    expect(desativar).not.toHaveBeenCalled();
  });

  it('exibe mensagem de erro quando a remocao falha com 409 (exercicio em uso)', async () => {
    const user = userEvent.setup();
    const desativar = vi.fn((_id, opts) => {
      opts.onError(makeAxiosError(409, { detail: 'em uso' }));
    });
    mockExercicioReturn({ data: exercicioFixture });
    mockDesativarReturn({ mutate: desativar });

    render(<ExercicioDetalhe exercicioId={exercicioFixture.id} />);

    await user.click(screen.getByRole('button', { name: /remover exercício/i }));

    expect(
      screen.getByText('Este exercício está em uso em fichas e não pode ser removido.'),
    ).toBeInTheDocument();
    expect(mockedReplace).not.toHaveBeenCalled();
  });
});
