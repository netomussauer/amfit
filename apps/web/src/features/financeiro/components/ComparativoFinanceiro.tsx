'use client';

import { useComparativoFinanceiro } from '../hooks/useComparativoFinanceiro';
import { formatBRL, formatCompetencia, formatPercent } from '../lib/format';
import { ComparativoFinanceiroChart } from './ComparativoFinanceiroChart';
import { Th } from './Th';

/**
 * Faturamento por competência dos últimos meses: gráfico de recebido vs.
 * previsto + tabela de apoio (acessível a leitores de tela, já que o
 * gráfico SVG é `aria-hidden`) com a taxa de inadimplência de cada mês.
 *
 * Sem argumento — o número de meses fica só no default do hook, para não
 * duplicar o valor "6" aqui e lá.
 */
export function ComparativoFinanceiro() {
  const { data, isLoading, isError, refetch } = useComparativoFinanceiro();

  if (isLoading) {
    return <ComparativoSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-[--color-border] bg-[--color-bg] px-4 py-12 text-center shadow-sm">
        <p role="alert" className="text-sm text-[--color-danger]">
          Não foi possível carregar o comparativo financeiro.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 rounded-md border border-[--color-border] px-3 py-1.5 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (data.data.length === 0) {
    return (
      <div className="rounded-lg border border-[--color-border] bg-[--color-bg] px-4 py-12 text-center shadow-sm">
        <p className="text-sm text-[--color-text-muted]">
          Nenhuma competência para comparar ainda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ComparativoFinanceiroChart competencias={data.data} />

      <section aria-labelledby="tabela-comparativo-heading">
        <h3
          id="tabela-comparativo-heading"
          className="mb-2 text-sm font-semibold text-[--color-text]"
        >
          Faturamento por competência
        </h3>
        <div className="overflow-x-auto rounded-lg border border-[--color-border] bg-[--color-bg] shadow-sm">
          <table
            className="w-full divide-y divide-[--color-border]"
            aria-label="Comparativo financeiro por competência"
          >
            <thead className="bg-[--color-bg-subtle]">
              <tr>
                <Th>Competência</Th>
                <Th>Recebido</Th>
                <Th>Previsto</Th>
                <Th>Taxa de inadimplência</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--color-border]">
              {data.data.map((c) => (
                <tr key={`${c.ano}-${c.mes}`}>
                  <td className="px-4 py-3 text-sm font-medium text-[--color-text]">
                    {formatCompetencia(c.ano, c.mes)}
                  </td>
                  <td className="px-4 py-3 text-sm text-[--color-text]">
                    {formatBRL(c.receita_paga)}
                  </td>
                  <td className="px-4 py-3 text-sm text-[--color-text-muted]">
                    {formatBRL(c.total_previsto)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <TaxaInadimplenciaBadge pct={c.taxa_inadimplencia_pct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TaxaInadimplenciaBadge({ pct }: { pct: number }) {
  const { rotulo, className } =
    pct > 25
      ? { rotulo: 'Crítica', className: 'text-[--color-danger]' }
      : pct >= 10
        ? { rotulo: 'Atenção', className: 'text-[--color-warning]' }
        : { rotulo: 'Baixa', className: 'text-[--color-success]' };

  return (
    <span className={`font-medium ${className}`}>
      {formatPercent(pct)} · {rotulo}
    </span>
  );
}

function ComparativoSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <div className="h-72 w-full animate-pulse rounded-lg border border-[--color-border] bg-[--color-bg-muted] shadow-sm" />
      <div className="h-40 w-full animate-pulse rounded-lg border border-[--color-border] bg-[--color-bg-muted] shadow-sm" />
    </div>
  );
}
