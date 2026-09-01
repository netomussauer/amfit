import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessaoResponse } from '@amfit/shared';
import { useSessao } from '../hooks/useSessao';
import { SessaoDetalhe } from './SessaoDetalhe';

vi.mock('../hooks/useSessao');

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

const mockedUseSessao = vi.mocked(useSessao);

function mockUseSessaoReturn(overrides: Partial<ReturnType<typeof useSessao>>) {
  mockedUseSessao.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useSessao>);
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

describe('SessaoDetalhe', () => {
  beforeEach(() => {
    mockedUseSessao.mockReset();
  });

  it('exibe mensagem de carregamento enquanto isLoading e true', () => {
    mockUseSessaoReturn({ isLoading: true });

    render(<SessaoDetalhe sessaoId="sessao-1" alunoId="aluno-1" />);

    expect(screen.getByText('Carregando sessão...')).toBeInTheDocument();
  });

  it('exibe erro com botao de retry quando isError e true', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseSessaoReturn({ isError: true, refetch });

    render(<SessaoDetalhe sessaoId="sessao-1" alunoId="aluno-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar esta sessão.',
    );

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renderiza titulo, status, metricas e a tabela de series por exercicio', () => {
    mockUseSessaoReturn({ data: sessaoComTreinoFixture });

    render(<SessaoDetalhe sessaoId="sessao-1" alunoId="aluno-1" />);

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

  it('exibe o fallback agrupado por item_treino_id quando a sessao nao tem treino expandido', () => {
    const semTreino: SessaoResponse = {
      ...sessaoComTreinoFixture,
      treino: undefined,
    };
    mockUseSessaoReturn({ data: semTreino });

    render(<SessaoDetalhe sessaoId="sessao-1" alunoId="aluno-1" />);

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
    mockUseSessaoReturn({ data: vazia });

    render(<SessaoDetalhe sessaoId="sessao-1" alunoId="aluno-1" />);

    expect(
      screen.getByText('Nenhuma série registrada nesta sessão.'),
    ).toBeInTheDocument();
  });
});
