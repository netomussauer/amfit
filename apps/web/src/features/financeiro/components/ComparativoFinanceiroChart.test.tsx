import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ComparativoFinanceiroResponse } from '@amfit/shared';
import { ComparativoFinanceiroChart } from './ComparativoFinanceiroChart';

// Mesmo raciocínio do smoke test de EvolucaoCargaChart: recharts depende de
// medições de layout que o jsdom não fornece de forma realista, então o
// teste aqui garante só que o componente monta sem lançar erro. O
// componente é explicitamente aria-hidden — a tabela renderizada por
// ComparativoFinanceiro é a fonte acessível dos mesmos dados.
const competenciasFixture: ComparativoFinanceiroResponse['data'] = [
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
];

describe('ComparativoFinanceiroChart', () => {
  it('monta sem lancar erro com competencias validas', () => {
    const { container } = render(
      <ComparativoFinanceiroChart competencias={competenciasFixture} />,
    );

    const wrapper = container.querySelector('[aria-hidden="true"]');
    expect(wrapper).toBeInTheDocument();
  });

  it('monta sem lancar erro quando nao ha competencias (lista vazia)', () => {
    const { container } = render(<ComparativoFinanceiroChart competencias={[]} />);

    const wrapper = container.querySelector('[aria-hidden="true"]');
    expect(wrapper).toBeInTheDocument();
  });
});
