import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessaoResponse } from '@amfit/shared';
import { useMinhaSessao } from '../hooks/useMinhaSessao';
import { MinhaSessaoDetalhe } from './MinhaSessaoDetalhe';

vi.mock('../hooks/useMinhaSessao');

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

const mockedUseMinhaSessao = vi.mocked(useMinhaSessao);

function mockUseMinhaSessaoReturn(overrides: Partial<ReturnType<typeof useMinhaSessao>>) {
  mockedUseMinhaSessao.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useMinhaSessao>);
}

const exercicioSupino = {
  id: 'exercicio-1',
  nome: 'Supino reto',
  descricao: null,
  grupo_muscular: { id: 'grupo-1', nome: 'Peito' },
  midia_url: null,
  tipo_midia: null,
  is_global: false,
};

const itemTreino = {
  id: 'item-1',
  ordem: 0,
  exercicio: exercicioSupino,
  series: 2,
  repeticoes: '10',
  carga_sugerida: 40,
  descanso_segundos: 60,
  observacao: null,
};

const sessaoComTreinoFixture: SessaoResponse = {
  id: 'sessao-1',
  treino_id: 'treino-1',
  data_execucao: '2026-01-10',
  status: 'CONCLUIDO',
  iniciado_em: '2026-01-10T10:00:00.000Z',
  concluido_em: '2026-01-10T10:30:00.000Z',
  series: [
    {
      id: 'serie-1',
      item_treino_id: 'item-1',
      numero_serie: 1,
      concluida: true,
      carga_realizada: 45,
      repeticoes_realizadas: 10,
    },
    {
      id: 'serie-2',
      item_treino_id: 'item-1',
      numero_serie: 2,
      concluida: false,
      carga_realizada: null,
      repeticoes_realizadas: null,
    },
  ],
  treino: {
    id: 'treino-1',
    letra: 'A',
    nome: 'Treino de peito',
    ordem: 0,
    itens: [itemTreino],
  },
};

describe('MinhaSessaoDetalhe', () => {
  beforeEach(() => {
    mockedUseMinhaSessao.mockReset();
  });

  it('exibe mensagem de carregamento enquanto isLoading e true', () => {
    mockUseMinhaSessaoReturn({ isLoading: true });

    render(<MinhaSessaoDetalhe sessaoId="sessao-1" />);

    expect(screen.getByText('Carregando sessão...')).toBeInTheDocument();
  });

  it('exibe erro com botao de retry quando isError e true', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseMinhaSessaoReturn({ isError: true, refetch });

    render(<MinhaSessaoDetalhe sessaoId="sessao-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar esta sessão.',
    );

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renderiza titulo, status, metricas e a tabela de series por exercicio', () => {
    mockUseMinhaSessaoReturn({ data: sessaoComTreinoFixture });

    render(<MinhaSessaoDetalhe sessaoId="sessao-1" />);

    expect(
      screen.getByRole('heading', { name: 'Treino A — Treino de peito' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Concluído')).toBeInTheDocument();

    // Metricas: 1 de 2 series concluidas; carga total = 45*10 (so a serie concluida)
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText('450 kg')).toBeInTheDocument();
    expect(screen.getByText('30m')).toBeInTheDocument();

    const tabela = screen.getByRole('table', { name: 'Séries de Supino reto' });
    const linhas = within(tabela).getAllByRole('row');
    // 1 cabecalho + 2 series
    expect(linhas).toHaveLength(3);
    expect(within(tabela).getByText('Concluída')).toBeInTheDocument();
    expect(within(tabela).getByText('Pulada')).toBeInTheDocument();
  });

  it('exibe link "Ver evolução" apontando para /progresso/:exercicioId', () => {
    mockUseMinhaSessaoReturn({ data: sessaoComTreinoFixture });

    render(<MinhaSessaoDetalhe sessaoId="sessao-1" />);

    expect(screen.getByRole('link', { name: 'Ver evolução' })).toHaveAttribute(
      'href',
      '/progresso/exercicio-1',
    );
  });

  it('exibe o breadcrumb apontando para /historico (sem referencia a alunos)', () => {
    mockUseMinhaSessaoReturn({ data: sessaoComTreinoFixture });

    render(<MinhaSessaoDetalhe sessaoId="sessao-1" />);

    expect(screen.getByRole('link', { name: 'Histórico' })).toHaveAttribute(
      'href',
      '/historico',
    );
  });

  it('exibe o fallback agrupado por item_treino_id quando a sessao nao tem treino expandido', () => {
    const semTreino: SessaoResponse = {
      ...sessaoComTreinoFixture,
      treino: undefined,
    };
    mockUseMinhaSessaoReturn({ data: semTreino });

    render(<MinhaSessaoDetalhe sessaoId="sessao-1" />);

    expect(screen.getByRole('heading', { name: 'Treino executado' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Séries da sessão' })).toBeInTheDocument();
    expect(screen.getByText('2 séries — 1 concluída')).toBeInTheDocument();
  });

  it('exibe mensagem de nenhuma serie registrada quando a sessao nao tem series nem treino', () => {
    const vazia: SessaoResponse = {
      ...sessaoComTreinoFixture,
      treino: undefined,
      series: [],
    };
    mockUseMinhaSessaoReturn({ data: vazia });

    render(<MinhaSessaoDetalhe sessaoId="sessao-1" />);

    expect(
      screen.getByText('Nenhuma série registrada nesta sessão.'),
    ).toBeInTheDocument();
  });
});
