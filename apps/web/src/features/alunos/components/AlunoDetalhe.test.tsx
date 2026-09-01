import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlunoResponse } from '@amfit/shared';
import { useAluno } from '../hooks/useAluno';
import { useDesativarAluno } from '../hooks/useDesativarAluno';
import { AlunoDetalhe } from './AlunoDetalhe';

vi.mock('../hooks/useAluno');
vi.mock('../hooks/useDesativarAluno');

// Isola o teste da renderizacao real do formulario de edicao — coberto
// separadamente em AlunoForm.test.tsx.
vi.mock('./AlunoForm', () => ({
  AlunoForm: ({ alunoId }: { alunoId: string }) => (
    <div data-testid="aluno-form-mock">form-{alunoId}</div>
  ),
}));

const mockedReplace = vi.fn();
const mockedRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockedReplace,
    refresh: mockedRefresh,
  }),
}));

// next/link usa contexto do App Router (prefetch via useRouter) que nao
// existe fora de uma arvore Next real; substitui por um <a> simples.
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockedUseAluno = vi.mocked(useAluno);
const mockedUseDesativarAluno = vi.mocked(useDesativarAluno);

function mockUseAlunoReturn(overrides: Partial<ReturnType<typeof useAluno>>) {
  mockedUseAluno.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useAluno>);
}

function mockUseDesativarAlunoReturn(overrides: Partial<ReturnType<typeof useDesativarAluno>>) {
  mockedUseDesativarAluno.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useDesativarAluno>);
}

const alunoFixture: AlunoResponse = {
  id: 'aluno-1',
  nome: 'João Silva',
  email: 'joao@aluno.app',
  ativo: true,
  criado_em: '2026-05-11T16:46:15Z',
};

describe('AlunoDetalhe', () => {
  beforeEach(() => {
    mockedUseAluno.mockReset();
    mockedUseDesativarAluno.mockReset();
    mockedReplace.mockReset();
    mockedRefresh.mockReset();
    mockUseDesativarAlunoReturn({});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('exibe mensagem de carregamento enquanto isLoading e true', () => {
    mockUseAlunoReturn({ isLoading: true });

    render(<AlunoDetalhe alunoId="aluno-1" />);

    expect(screen.getByText('Carregando aluno...')).toBeInTheDocument();
  });

  it('exibe erro com botao de retry quando isError e true', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseAlunoReturn({ isError: true, refetch });

    render(<AlunoDetalhe alunoId="aluno-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar este aluno.');

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renderiza nome, email, status e o formulario de edicao quando o aluno carrega', () => {
    mockUseAlunoReturn({ data: alunoFixture });

    render(<AlunoDetalhe alunoId="aluno-1" />);

    expect(screen.getByRole('heading', { name: 'João Silva' })).toBeInTheDocument();
    expect(screen.getByText('joao@aluno.app')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByTestId('aluno-form-mock')).toHaveTextContent('form-aluno-1');
  });

  it('exibe o botao de desativar apenas quando o aluno esta ativo', () => {
    mockUseAlunoReturn({ data: { ...alunoFixture, ativo: false } });

    render(<AlunoDetalhe alunoId="aluno-1" />);

    expect(screen.getByText('Inativo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /desativar aluno/i })).not.toBeInTheDocument();
  });

  it('nao desativa quando o usuario cancela a confirmacao', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    const mutate = vi.fn();
    mockUseAlunoReturn({ data: alunoFixture });
    mockUseDesativarAlunoReturn({ mutate });

    render(<AlunoDetalhe alunoId="aluno-1" />);

    await user.click(screen.getByRole('button', { name: /desativar aluno/i }));

    expect(mutate).not.toHaveBeenCalled();
  });

  it('desativa o aluno e navega para /alunos ao confirmar', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((id, opts) => {
      opts.onSuccess();
    });
    mockUseAlunoReturn({ data: alunoFixture });
    mockUseDesativarAlunoReturn({ mutate });

    render(<AlunoDetalhe alunoId="aluno-1" />);

    await user.click(screen.getByRole('button', { name: /desativar aluno/i }));

    expect(mutate).toHaveBeenCalledWith('aluno-1', expect.anything());
    expect(mockedReplace).toHaveBeenCalledWith('/alunos');
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it('exibe mensagem de erro na acao quando a desativacao falha', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((id, opts) => {
      opts.onError();
    });
    mockUseAlunoReturn({ data: alunoFixture });
    mockUseDesativarAlunoReturn({ mutate });

    render(<AlunoDetalhe alunoId="aluno-1" />);

    await user.click(screen.getByRole('button', { name: /desativar aluno/i }));

    expect(
      screen.getByText('Não foi possível desativar o aluno. Tente novamente.'),
    ).toBeInTheDocument();
  });
});
