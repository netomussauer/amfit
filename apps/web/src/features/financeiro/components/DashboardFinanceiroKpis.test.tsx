import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardFinanceiroResponse } from '@amfit/shared';
import { useDashboardFinanceiro } from '../hooks/useDashboardFinanceiro';
import { DashboardFinanceiroKpis } from './DashboardFinanceiroKpis';

vi.mock('../hooks/useDashboardFinanceiro');

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

const mockedUseDashboardFinanceiro = vi.mocked(useDashboardFinanceiro);

function mockUseDashboardReturn(overrides: Partial<ReturnType<typeof useDashboardFinanceiro>>) {
  mockedUseDashboardFinanceiro.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useDashboardFinanceiro>);
}

const dashboardFixture: DashboardFinanceiroResponse = {
  mensalidades_pendentes: { qtd: 2, valor: 400 },
  mensalidades_atrasadas: { qtd: 1, valor: 200 },
  receita_mes_atual: 600,
  inadimplentes: [
    { aluno_id: 'aluno-1', nome: 'João Silva', qtd_atrasadas: 1, valor_total_atrasado: 200 },
  ],
};

describe('DashboardFinanceiroKpis', () => {
  beforeEach(() => {
    mockedUseDashboardFinanceiro.mockReset();
  });

  it('exibe o skeleton de carregamento enquanto isLoading e true', () => {
    mockUseDashboardReturn({ isLoading: true });

    const { container } = render(<DashboardFinanceiroKpis />);

    expect(screen.queryByText('Receita do mês')).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('exibe erro com retry quando a busca falha', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseDashboardReturn({ isError: true, refetch });

    render(<DashboardFinanceiroKpis />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o dashboard financeiro.',
    );
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('mostra os indicadores e a lista de inadimplentes', () => {
    mockUseDashboardReturn({ data: dashboardFixture });

    render(<DashboardFinanceiroKpis />);

    expect(screen.getByText(/R\$\s*600,00/)).toBeInTheDocument();
    expect(screen.getByText('João Silva')).toBeInTheDocument();
  });

  it('nao mostra a secao de inadimplentes quando a lista esta vazia', () => {
    mockUseDashboardReturn({ data: { ...dashboardFixture, inadimplentes: [] } });

    render(<DashboardFinanceiroKpis />);

    expect(screen.queryByText(/mensalidades atrasadas/i)).not.toBeInTheDocument();
  });
});
