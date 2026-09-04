'use client';

import Link from 'next/link';
import { useDashboardFinanceiro } from '../hooks/useDashboardFinanceiro';
import { formatBRL } from '../lib/format';

export function DashboardFinanceiroKpis() {
  const { data, isLoading, isError, refetch } = useDashboardFinanceiro();

  if (isLoading) {
    return <KpiSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-[--color-border] bg-[--color-bg] px-4 py-12 text-center shadow-sm">
        <p role="alert" className="text-sm text-[--color-danger]">
          Não foi possível carregar o dashboard financeiro.
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

  return (
    <div className="space-y-6">
      <section
        aria-label="Indicadores financeiros"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <KpiCard label="Receita do mês" value={formatBRL(data.receita_mes_atual)} />
        <KpiCard
          label="Pendentes"
          value={`${data.mensalidades_pendentes.qtd} · ${formatBRL(data.mensalidades_pendentes.valor)}`}
        />
        <KpiCard
          label="Atrasadas"
          value={`${data.mensalidades_atrasadas.qtd} · ${formatBRL(data.mensalidades_atrasadas.valor)}`}
          variant={data.mensalidades_atrasadas.qtd > 0 ? 'warning' : 'default'}
        />
      </section>

      {data.inadimplentes.length > 0 && (
        <section
          aria-labelledby="inadimplentes-heading"
          className="rounded-lg border border-[--color-border] bg-[--color-bg] p-4 shadow-sm"
        >
          <h3
            id="inadimplentes-heading"
            className="mb-3 text-sm font-semibold text-[--color-text]"
          >
            Alunos com mensalidades atrasadas
          </h3>
          <ul className="divide-y divide-[--color-border]">
            {data.inadimplentes.map((a) => (
              <li key={a.aluno_id} className="flex items-center justify-between py-2 text-sm">
                <Link
                  href={`/alunos/${a.aluno_id}`}
                  className="font-medium text-[--color-primary] hover:text-[--color-primary-hover]"
                >
                  {a.nome}
                </Link>
                <span className="text-[--color-text-muted]">
                  {a.qtd_atrasadas} {a.qtd_atrasadas === 1 ? 'mensalidade' : 'mensalidades'} ·{' '}
                  {formatBRL(a.valor_total_atrasado)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type KpiCardProps = {
  label: string;
  value: string;
  variant?: 'default' | 'warning';
};

function KpiCard({ label, value, variant = 'default' }: KpiCardProps) {
  const valueClass = variant === 'warning' ? 'text-[--color-warning]' : 'text-[--color-text]';

  return (
    <div className="rounded-lg border border-[--color-border] bg-[--color-bg] p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-[--color-text-muted]">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="space-y-2 rounded-lg border border-[--color-border] bg-[--color-bg] p-4 shadow-sm"
        >
          <div className="h-3 w-2/3 animate-pulse rounded bg-[--color-bg-muted]" />
          <div className="h-7 w-1/3 animate-pulse rounded bg-[--color-bg-muted]" />
        </div>
      ))}
    </div>
  );
}
