import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessaoListResponse } from '@amfit/shared';
import { useMinhasSessoes } from '../hooks/useMinhasSessoes';
import { MinhasSessoesTable } from './MinhasSessoesTable';

vi.mock('../hooks/useMinhasSessoes');

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

const mockedUseMinhasSessoes = vi.mocked(useMinhasSessoes);

function mockUseMinhasSessoesReturn(overrides: Partial<ReturnType<typeof useMinhasSessoes>>) {
  mockedUseMinhasSessoes.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useMinhasSessoes>);
}

const sessaoResumo1 = {
  id: 'sessao-1',
  treino_id: 'treino-1',
  treino_letra: 'A',
  treino_nome: 'Treino de peito',
  data_execucao: '2026-01-10',
  status: 'CONCLUIDO' as const,
  iniciado_em: '2026-01-10T10:00:00Z',
  concluido_em: '2026-01-10T10:30:00Z',
  total_series: 10,
  series_concluidas: 10,
};

const sessaoResumo2 = {
  id: 'sessao-2',
  treino_id: 'treino-2',
  treino_letra: 'B',
  treino_nome: null,
  data_execucao: '2026-01-05',
  status: 'ABANDONADO' as const,
  iniciado_em: '2026-01-05T10:00:00Z',
  concluido_em: null,
  total_series: 8,
  series_concluidas: 3,
};

const listFixture: SessaoListResponse = {
  data: [sessaoResumo1, sessaoResumo2],
  pagination: { total: 2, page: 1, per_page: 20 },
};

describe('MinhasSessoesTable', () => {
  beforeEach(() => {
    mockedUseMinhasSessoes.mockReset();
  });

  it('exibe mensagem de carregamento enquanto isLoading e true', () => {
    mockUseMinhasSessoesReturn({ isLoading: true });

    render(<MinhasSessoesTable />);

    expect(screen.getByText('Carregando histórico...')).toBeInTheDocument();
  });

  it('exibe erro com botao de retry quando isError e true', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseMinhasSessoesReturn({ isError: true, refetch });

    render(<MinhasSessoesTable />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar seu histórico de sessões.',
    );

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('exibe estado vazio quando o aluno nao tem sessoes', () => {
    mockUseMinhasSessoesReturn({
      data: { data: [], pagination: { total: 0, page: 1, per_page: 20 } },
    });

    render(<MinhasSessoesTable />);

    expect(
      screen.getByText('Você ainda não executou nenhuma sessão de treino.'),
    ).toBeInTheDocument();
  });

  it('renderiza as linhas da tabela com data, treino, status, progresso e duracao', () => {
    mockUseMinhasSessoesReturn({ data: listFixture });

    render(<MinhasSessoesTable />);

    const tabela = screen.getByRole('table', { name: 'Histórico das minhas sessões' });
    const linhas = within(tabela).getAllByRole('row');
    // 1 cabecalho + 2 sessoes
    expect(linhas).toHaveLength(3);

    expect(within(tabela).getByText('10/01/2026')).toBeInTheDocument();
    expect(within(tabela).getByText('Treino de peito')).toBeInTheDocument();
    expect(within(tabela).getByText('Concluído')).toBeInTheDocument();
    expect(within(tabela).getByText('30m')).toBeInTheDocument();

    expect(within(tabela).getByText('05/01/2026')).toBeInTheDocument();
    // sem treino_nome, usa fallback "Treino B"
    expect(within(tabela).getByText('Treino B')).toBeInTheDocument();
    expect(within(tabela).getByText('Abandonado')).toBeInTheDocument();
    // sem concluido_em, duracao exibe travessao
    expect(within(tabela).getAllByText('—').length).toBeGreaterThan(0);

    const linksDetalhe = within(tabela).getAllByRole('link', { name: /ver detalhes/i });
    expect(linksDetalhe[0]).toHaveAttribute('href', '/historico/sessao-1');
    expect(linksDetalhe[1]).toHaveAttribute('href', '/historico/sessao-2');
  });

  it('exibe a barra de progresso com os valores de series concluidas/total', () => {
    mockUseMinhasSessoesReturn({ data: listFixture });

    render(<MinhasSessoesTable />);

    const progress = screen.getByRole('progressbar', {
      name: 'Progresso: 3 de 8 séries',
    });
    expect(progress).toHaveAttribute('aria-valuenow', '38');
  });

  it('exibe a paginacao e desabilita "Anterior" na primeira pagina', () => {
    mockUseMinhasSessoesReturn({
      data: { data: [sessaoResumo1], pagination: { total: 25, page: 1, per_page: 20 } },
    });

    render(<MinhasSessoesTable />);

    expect(screen.getByText('Página 1 de 2 — 25 sessões')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /página anterior/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /próxima página/i })).toBeEnabled();
  });

  it('avanca para a proxima pagina ao clicar em "Próxima", refazendo a busca com a nova pagina', async () => {
    const user = userEvent.setup();
    mockUseMinhasSessoesReturn({
      data: { data: [sessaoResumo1], pagination: { total: 25, page: 1, per_page: 20 } },
    });

    render(<MinhasSessoesTable />);

    await user.click(screen.getByRole('button', { name: /próxima página/i }));

    const ultimaChamada = mockedUseMinhasSessoes.mock.calls.at(-1)?.[0];
    expect(ultimaChamada).toEqual({ page: 2, perPage: 20 });
  });

  it('exibe o resumo de paginacao no singular quando ha apenas 1 sessao no total', () => {
    mockUseMinhasSessoesReturn({
      data: { data: [sessaoResumo1], pagination: { total: 1, page: 1, per_page: 20 } },
    });

    render(<MinhasSessoesTable />);

    expect(screen.getByText('Página 1 de 1 — 1 sessão')).toBeInTheDocument();
  });
});
