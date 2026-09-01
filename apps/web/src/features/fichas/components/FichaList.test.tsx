import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FichaListResponse } from '@amfit/shared';
import { useFichas } from '../hooks/useFichas';
import { FichaList } from './FichaList';

vi.mock('../hooks/useFichas');

// next/link usa contexto do App Router (prefetch via useRouter) que nao
// existe fora de uma arvore Next real; substitui por um <a> simples.
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

const mockedUseFichas = vi.mocked(useFichas);

function mockUseFichasReturn(overrides: Partial<ReturnType<typeof useFichas>>) {
  mockedUseFichas.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useFichas>);
}

const fichasFixture: FichaListResponse = {
  data: [
    {
      id: 'ficha-1',
      nome: 'Hipertrofia — Maio/2026',
      aluno_id: 'aluno-1',
      vigencia_inicio: '2026-05-01',
      vigencia_fim: '2026-08-01',
      ativa: true,
      treinos: [
        { id: 'treino-1', letra: 'A', ordem: 0, itens: [] },
        { id: 'treino-2', letra: 'B', ordem: 1, itens: [] },
      ],
    },
    {
      id: 'ficha-2',
      nome: 'Emagrecimento — Jan/2026',
      aluno_id: 'aluno-1',
      vigencia_inicio: '2026-01-01',
      ativa: false,
      treinos: [],
    },
  ],
};

describe('FichaList', () => {
  beforeEach(() => {
    mockedUseFichas.mockReset();
  });

  it('busca as fichas do aluno informado', () => {
    mockUseFichasReturn({ data: fichasFixture });

    render(<FichaList alunoId="aluno-1" />);

    expect(mockedUseFichas).toHaveBeenCalledWith({ aluno_id: 'aluno-1' });
  });

  it('exibe o skeleton de carregamento enquanto isLoading e true', () => {
    mockUseFichasReturn({ isLoading: true });

    render(<FichaList alunoId="aluno-1" />);

    expect(screen.queryByRole('list', { name: 'Lista de fichas' })).not.toBeInTheDocument();
  });

  it('exibe erro com botao de retry quando isError e true', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseFichasReturn({ isError: true, refetch });

    render(<FichaList alunoId="aluno-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar as fichas.');

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('exibe estado vazio com link para criar a primeira ficha', () => {
    mockUseFichasReturn({ data: { data: [] } });

    render(<FichaList alunoId="aluno-1" />);

    expect(screen.getByText('Nenhuma ficha cadastrada para este aluno.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /criar primeira ficha/i })).toHaveAttribute(
      'href',
      '/alunos/aluno-1/fichas/nova',
    );
  });

  it('renderiza um cartao por ficha com nome, vigencia, status e total de treinos', () => {
    mockUseFichasReturn({ data: fichasFixture });

    render(<FichaList alunoId="aluno-1" />);

    expect(screen.getByRole('link', { name: 'Abrir ficha Hipertrofia — Maio/2026' })).toHaveAttribute(
      'href',
      '/alunos/aluno-1/fichas/ficha-1',
    );
    expect(screen.getByText('01/05/2026 — 01/08/2026')).toBeInTheDocument();
    expect(screen.getByText('2 treinos')).toBeInTheDocument();
    expect(screen.getByText('Ativa')).toBeInTheDocument();

    expect(screen.getByText('01/01/2026 — em aberto')).toBeInTheDocument();
    expect(screen.getByText('Nenhum cadastrado')).toBeInTheDocument();
    expect(screen.getByText('Inativa')).toBeInTheDocument();
  });

  it('inclui link para "Nova ficha" apontando para a rota de criacao do aluno', () => {
    mockUseFichasReturn({ data: fichasFixture });

    render(<FichaList alunoId="aluno-1" />);

    expect(screen.getByRole('link', { name: 'Nova ficha' })).toHaveAttribute(
      'href',
      '/alunos/aluno-1/fichas/nova',
    );
  });
});
