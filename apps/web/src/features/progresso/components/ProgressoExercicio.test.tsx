import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calcularDataInicio } from '@amfit/shared';
import type { AlunoResponse, ExercicioResponse, HistoricoExercicioResponse } from '@amfit/shared';
import { useAluno } from '@/features/alunos/hooks/useAluno';
import { useExercicio } from '@/features/exercicios/hooks/useExercicio';
import { useHistoricoExercicio } from '../hooks/useHistoricoExercicio';
import { ProgressoExercicio } from './ProgressoExercicio';

vi.mock('@/features/alunos/hooks/useAluno');
vi.mock('@/features/exercicios/hooks/useExercicio');
vi.mock('../hooks/useHistoricoExercicio');

// Isola o teste da renderizacao real do recharts — coberto separadamente em
// EvolucaoCargaChart.test.tsx.
vi.mock('./EvolucaoCargaChart', () => ({
  EvolucaoCargaChart: () => <div data-testid="evolucao-chart-mock" />,
}));

// next/link usa contexto do App Router (prefetch via useRouter) que nao
// existe fora de uma arvore Next real; substitui por um <a> simples.
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockedUseAluno = vi.mocked(useAluno);
const mockedUseExercicio = vi.mocked(useExercicio);
const mockedUseHistorico = vi.mocked(useHistoricoExercicio);

function mockAluno(overrides: Partial<AlunoResponse> = {}) {
  mockedUseAluno.mockReturnValue({
    data: { id: 'aluno-1', nome: 'Maria Silva', ...overrides },
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useAluno>);
}

function mockExercicio(overrides: Partial<ExercicioResponse> = {}) {
  mockedUseExercicio.mockReturnValue({
    data: { id: 'exercicio-1', nome: 'Supino reto', ...overrides },
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useExercicio>);
}

function mockHistorico(overrides: Partial<ReturnType<typeof useHistoricoExercicio>>) {
  mockedUseHistorico.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useHistoricoExercicio>);
}

const historicoFixture: HistoricoExercicioResponse = {
  aluno_id: 'aluno-1',
  exercicio_id: 'exercicio-1',
  pontos: [
    {
      sessao_id: 'sessao-1',
      data_execucao: '2026-01-10',
      numero_serie: 1,
      carga_realizada: 40,
      repeticoes_realizadas: 10,
    },
    {
      sessao_id: 'sessao-1',
      data_execucao: '2026-01-10',
      numero_serie: 2,
      carga_realizada: 45,
      repeticoes_realizadas: 8,
    },
    {
      sessao_id: 'sessao-2',
      data_execucao: '2026-01-17',
      numero_serie: 1,
      carga_realizada: 50,
      repeticoes_realizadas: 10,
    },
  ],
};

describe('ProgressoExercicio', () => {
  beforeEach(() => {
    mockedUseAluno.mockReset();
    mockedUseExercicio.mockReset();
    mockedUseHistorico.mockReset();
    mockAluno();
    mockExercicio();
  });

  it('exibe placeholders no breadcrumb/titulo enquanto aluno e exercicio ainda nao carregaram', () => {
    mockedUseAluno.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof useAluno>);
    mockedUseExercicio.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof useExercicio>);
    mockHistorico({ isLoading: true });

    render(<ProgressoExercicio alunoId="aluno-1" exercicioId="exercicio-1" />);

    expect(screen.getByRole('heading', { name: 'Evolução de carga' })).toBeInTheDocument();
  });

  it('exibe o skeleton de carregamento enquanto o historico esta carregando', () => {
    mockHistorico({ isLoading: true });

    render(<ProgressoExercicio alunoId="aluno-1" exercicioId="exercicio-1" />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('exibe erro com botao de retry quando o historico falha ao carregar', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockHistorico({ isError: true, refetch });

    render(<ProgressoExercicio alunoId="aluno-1" exercicioId="exercicio-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o histórico deste exercício.',
    );

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('exibe estado vazio quando nao ha pontos de progresso no periodo', () => {
    mockHistorico({ data: { aluno_id: 'aluno-1', exercicio_id: 'exercicio-1', pontos: [] } });

    render(<ProgressoExercicio alunoId="aluno-1" exercicioId="exercicio-1" />);

    expect(
      screen.getByText('Nenhum registro de carga para este exercício no período selecionado.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renderiza breadcrumb, titulo, grafico e tabela agregada quando os dados chegam', () => {
    mockHistorico({ data: historicoFixture });

    render(<ProgressoExercicio alunoId="aluno-1" exercicioId="exercicio-1" />);

    expect(screen.getByRole('link', { name: 'Maria Silva' })).toHaveAttribute(
      'href',
      '/alunos/aluno-1',
    );
    expect(screen.getByRole('heading', { name: 'Supino reto' })).toBeInTheDocument();
    expect(screen.getByTestId('evolucao-chart-mock')).toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Evolução de carga por sessão' });
    const rows = within(table).getAllByRole('row');
    // 1 linha de cabecalho + 2 sessoes agregadas (sessao-1 com 2 series, sessao-2 com 1)
    expect(rows).toHaveLength(3);

    expect(within(table).getByText('10/01/2026')).toBeInTheDocument();
    expect(within(table).getByText('45 kg')).toBeInTheDocument(); // carga maxima da sessao-1
    expect(within(table).getByText('17/01/2026')).toBeInTheDocument();
    expect(within(table).getByText('50 kg')).toBeInTheDocument(); // carga maxima da sessao-2
  });

  it('inicia com o filtro de periodo "Últimos 90 dias" selecionado', () => {
    mockHistorico({ data: historicoFixture });

    render(<ProgressoExercicio alunoId="aluno-1" exercicioId="exercicio-1" />);

    expect(screen.getByRole('radio', { name: 'Últimos 90 dias' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('ao trocar o periodo, atualiza a selecao e refaz a busca do historico com o novo "from"', async () => {
    const user = userEvent.setup();
    mockHistorico({ data: historicoFixture });

    render(<ProgressoExercicio alunoId="aluno-1" exercicioId="exercicio-1" />);

    await user.click(screen.getByRole('radio', { name: 'Últimos 30 dias' }));

    expect(screen.getByRole('radio', { name: 'Últimos 30 dias' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'Últimos 90 dias' })).toHaveAttribute(
      'aria-checked',
      'false',
    );

    const ultimaChamada = mockedUseHistorico.mock.calls.at(-1)?.[0];
    expect(ultimaChamada).toEqual({
      alunoId: 'aluno-1',
      exercicioId: 'exercicio-1',
      from: calcularDataInicio(30),
    });
  });

  it('remove o filtro "from" ao selecionar "Todo o período"', async () => {
    const user = userEvent.setup();
    mockHistorico({ data: historicoFixture });

    render(<ProgressoExercicio alunoId="aluno-1" exercicioId="exercicio-1" />);

    await user.click(screen.getByRole('radio', { name: 'Todo o período' }));

    const ultimaChamada = mockedUseHistorico.mock.calls.at(-1)?.[0];
    expect(ultimaChamada).toEqual({
      alunoId: 'aluno-1',
      exercicioId: 'exercicio-1',
      from: undefined,
    });
  });
});
