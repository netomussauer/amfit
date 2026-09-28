import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComparativoFinanceiroResponse } from '@amfit/shared';
import { useComparativoFinanceiro } from '../hooks/useComparativoFinanceiro';
import { ComparativoFinanceiro } from './ComparativoFinanceiro';

vi.mock('../hooks/useComparativoFinanceiro');

const mockedUseComparativoFinanceiro = vi.mocked(useComparativoFinanceiro);

function mockUseComparativoReturn(
  overrides: Partial<ReturnType<typeof useComparativoFinanceiro>>,
) {
  mockedUseComparativoFinanceiro.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useComparativoFinanceiro>);
}

const comparativoFixture: ComparativoFinanceiroResponse = {
  data: [
    {
      ano: 2026,
      mes: 8,
      receita_paga: 800,
      total_previsto: 1000,
      valor_atrasado: 200,
      taxa_inadimplencia_pct: 20,
    },
    {
      ano: 2026,
      mes: 9,
      receita_paga: 0,
      total_previsto: 0,
      valor_atrasado: 0,
      taxa_inadimplencia_pct: 0,
    },
  ],
};

describe('ComparativoFinanceiro', () => {
  beforeEach(() => {
    mockedUseComparativoFinanceiro.mockReset();
  });

  it('exibe o skeleton de carregamento enquanto isLoading e true', () => {
    mockUseComparativoReturn({ isLoading: true });

    const { container } = render(<ComparativoFinanceiro />);

    expect(screen.queryByText('Faturamento por competência')).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('exibe erro com retry quando a busca falha', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseComparativoReturn({ isError: true, refetch });

    render(<ComparativoFinanceiro />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o comparativo financeiro.',
    );
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('mostra mensagem quando nao ha competencias', () => {
    mockUseComparativoReturn({ data: { data: [] } });

    render(<ComparativoFinanceiro />);

    expect(screen.getByText('Nenhuma competência para comparar ainda.')).toBeInTheDocument();
  });

  it('mostra a tabela com recebido, previsto e a taxa de inadimplencia por competencia', () => {
    mockUseComparativoReturn({ data: comparativoFixture });

    render(<ComparativoFinanceiro />);

    expect(screen.getByText('08/2026')).toBeInTheDocument();
    expect(screen.getByText('R$ 800,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.000,00')).toBeInTheDocument();
    expect(screen.getByText('20,0% · Atenção')).toBeInTheDocument();
  });

  it('classifica taxas acima de 25% como critica e abaixo de 10% como baixa', () => {
    mockUseComparativoReturn({
      data: {
        data: [
          { ano: 2026, mes: 7, receita_paga: 0, total_previsto: 1000, valor_atrasado: 300, taxa_inadimplencia_pct: 30 },
          { ano: 2026, mes: 8, receita_paga: 0, total_previsto: 1000, valor_atrasado: 50, taxa_inadimplencia_pct: 5 },
        ],
      },
    });

    render(<ComparativoFinanceiro />);

    expect(screen.getByText('30,0% · Crítica')).toBeInTheDocument();
    expect(screen.getByText('5,0% · Baixa')).toBeInTheDocument();
  });
});
