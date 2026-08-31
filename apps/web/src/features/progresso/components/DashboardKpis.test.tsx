import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardResponse } from '@amfit/shared';
import { useDashboard } from '../hooks/useDashboard';
import { DashboardKpis } from './DashboardKpis';

vi.mock('../hooks/useDashboard');

const mockedUseDashboard = vi.mocked(useDashboard);

function mockUseDashboardReturn(overrides: Partial<ReturnType<typeof useDashboard>>) {
  mockedUseDashboard.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useDashboard>);
}

const dashboardFixture: DashboardResponse = {
  alunos_ativos: 42,
  fichas_ativas: 30,
  sessoes_ultimos_7_dias: 18,
  sessoes_ultimos_30_dias: 90,
  alunos_sem_sessao_7_dias: 0,
};

describe('DashboardKpis', () => {
  beforeEach(() => {
    mockedUseDashboard.mockReset();
  });

  it('exibe o skeleton de carregamento enquanto isLoading e true', () => {
    mockUseDashboardReturn({ isLoading: true });

    const { container } = render(<DashboardKpis />);

    expect(screen.queryByText('Alunos ativos')).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('exibe mensagem de erro com botao de retry quando isError e true', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseDashboardReturn({ isError: true, refetch });

    render(<DashboardKpis />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o dashboard.');

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('exibe mensagem de erro quando data e undefined mesmo sem isError explicito', () => {
    mockUseDashboardReturn({ data: undefined, isError: false });

    render(<DashboardKpis />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renderiza os 5 KPIs com os valores retornados pelo hook', () => {
    mockUseDashboardReturn({ data: dashboardFixture });

    render(<DashboardKpis />);

    expect(screen.getByText('Alunos ativos')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Fichas ativas')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('Sessões (últimos 7 dias)')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('Sessões (últimos 30 dias)')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('Alunos sem sessão há 7 dias')).toBeInTheDocument();
  });

  it('nao exibe hint de alerta quando alunos_sem_sessao_7_dias e zero', () => {
    mockUseDashboardReturn({ data: { ...dashboardFixture, alunos_sem_sessao_7_dias: 0 } });

    render(<DashboardKpis />);

    expect(screen.queryByText(/vale dar uma olhada/i)).not.toBeInTheDocument();
  });

  it('exibe hint de alerta quando ha alunos sem sessao ha 7 dias', () => {
    mockUseDashboardReturn({ data: { ...dashboardFixture, alunos_sem_sessao_7_dias: 4 } });

    render(<DashboardKpis />);

    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText(/vale dar uma olhada/i)).toBeInTheDocument();
  });
});
