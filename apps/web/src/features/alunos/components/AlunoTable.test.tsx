import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlunoListResponse } from '@amfit/shared';
import { useAlunos } from '../hooks/useAlunos';
import { AlunoTable } from './AlunoTable';

vi.mock('../hooks/useAlunos');

// next/link usa contexto do App Router (prefetch via useRouter) que nao
// existe fora de uma arvore Next real; substitui por um <a> simples.
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockedUseAlunos = vi.mocked(useAlunos);

function mockUseAlunosReturn(overrides: Partial<ReturnType<typeof useAlunos>>) {
  mockedUseAlunos.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useAlunos>);
}

const alunosFixture: AlunoListResponse = {
  data: [
    {
      id: 'aluno-1',
      nome: 'João Silva',
      email: 'joao@aluno.app',
      telefone: '(11) 99999-9999',
      ativo: true,
      criado_em: '2026-05-11T16:46:15Z',
    },
    {
      id: 'aluno-2',
      nome: 'Maria Souza',
      email: 'maria@aluno.app',
      ativo: false,
      criado_em: '2026-05-12T16:46:15Z',
    },
  ],
  pagination: { total: 2, page: 1, per_page: 20 },
};

describe('AlunoTable', () => {
  beforeEach(() => {
    mockedUseAlunos.mockReset();
  });

  it('exibe mensagem de carregamento enquanto isLoading e true', () => {
    mockUseAlunosReturn({ isLoading: true });

    render(<AlunoTable />);

    expect(screen.getByText('Carregando alunos...')).toBeInTheDocument();
  });

  it('exibe erro com botao de retry quando isError e true', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseAlunosReturn({ isError: true, refetch });

    render(<AlunoTable />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar a lista de alunos.',
    );

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('exibe estado vazio com link para cadastro quando nao ha alunos', () => {
    mockUseAlunosReturn({
      data: { data: [], pagination: { total: 0, page: 1, per_page: 20 } },
    });

    render(<AlunoTable />);

    expect(screen.getByText('Nenhum aluno encontrado.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cadastrar primeiro aluno/i })).toHaveAttribute(
      'href',
      '/alunos/novo',
    );
  });

  it('renderiza as linhas da tabela com os dados de cada aluno', () => {
    mockUseAlunosReturn({ data: alunosFixture });

    render(<AlunoTable />);

    const table = screen.getByRole('table', { name: 'Lista de alunos' });
    const rows = within(table).getAllByRole('row');
    // 1 linha de cabecalho + 2 alunos
    expect(rows).toHaveLength(3);

    expect(screen.getByRole('link', { name: 'João Silva' })).toHaveAttribute(
      'href',
      '/alunos/aluno-1',
    );
    expect(screen.getByText('joao@aluno.app')).toBeInTheDocument();
    expect(screen.getByText('(11) 99999-9999')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByText('Inativo')).toBeInTheDocument();
    // telefone ausente no segundo aluno deve exibir o placeholder em travessao
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('busca a primeira pagina de alunos ativos por padrao', () => {
    mockUseAlunosReturn({ data: alunosFixture });

    render(<AlunoTable />);

    expect(mockedUseAlunos).toHaveBeenCalledWith({ page: 1, perPage: 20, ativo: true });
  });

  it('ao marcar "mostrar inativos", refaz a busca sem o filtro de ativo', async () => {
    const user = userEvent.setup();
    mockUseAlunosReturn({ data: alunosFixture });

    render(<AlunoTable />);

    await user.click(screen.getByLabelText(/mostrar inativos/i));

    expect(mockedUseAlunos).toHaveBeenLastCalledWith({
      page: 1,
      perPage: 20,
      ativo: undefined,
    });
  });

  it('avanca para a proxima pagina ao clicar em "Próxima" e desabilita quando nao ha mais paginas', async () => {
    const user = userEvent.setup();
    mockUseAlunosReturn({
      data: {
        data: alunosFixture.data,
        pagination: { total: 40, page: 1, per_page: 20 },
      },
    });

    render(<AlunoTable />);

    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled();
    const proximaBtn = screen.getByRole('button', { name: /próxima/i });
    expect(proximaBtn).not.toBeDisabled();

    await user.click(proximaBtn);

    expect(mockedUseAlunos).toHaveBeenLastCalledWith({ page: 2, perPage: 20, ativo: true });
  });

  it('reseta para a pagina 1 ao alternar o filtro de inativos mesmo estando em outra pagina', async () => {
    const user = userEvent.setup();
    mockUseAlunosReturn({
      data: {
        data: alunosFixture.data,
        pagination: { total: 40, page: 1, per_page: 20 },
      },
    });

    render(<AlunoTable />);

    await user.click(screen.getByRole('button', { name: /próxima/i }));
    await user.click(screen.getByLabelText(/mostrar inativos/i));

    expect(mockedUseAlunos).toHaveBeenLastCalledWith({
      page: 1,
      perPage: 20,
      ativo: undefined,
    });
  });

  it('exibe o resumo de paginacao com total de alunos', () => {
    mockUseAlunosReturn({ data: alunosFixture });

    render(<AlunoTable />);

    expect(screen.getByText('Página 1 de 1 — 2 alunos')).toBeInTheDocument();
  });
});
