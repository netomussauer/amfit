'use client';

import { useDashboard } from '../hooks/useDashboard';

export function DashboardKpis() {
  const { data, isLoading, isError, refetch } = useDashboard();

  if (isLoading) {
    return <KpiSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-[--color-border] bg-[--color-bg] px-4 py-12 text-center shadow-sm">
        <p role="alert" className="text-sm text-[--color-danger]">
          Não foi possível carregar o dashboard.
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

  const alunosSemSessao = data.alunos_sem_sessao_7_dias;

  return (
    <section
      aria-label="Indicadores gerais"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
    >
      <KpiCard label="Alunos ativos" value={data.alunos_ativos} />
      <KpiCard label="Fichas ativas" value={data.fichas_ativas} />
      <KpiCard
        label="Sessões (últimos 7 dias)"
        value={data.sessoes_ultimos_7_dias}
      />
      <KpiCard
        label="Sessões (últimos 30 dias)"
        value={data.sessoes_ultimos_30_dias}
      />
      <KpiCard
        label="Alunos sem sessão há 7 dias"
        value={alunosSemSessao}
        variant={alunosSemSessao > 0 ? 'warning' : 'default'}
        hint={
          alunosSemSessao > 0
            ? 'Vale dar uma olhada em quem está sumido.'
            : undefined
        }
      />
    </section>
  );
}

type KpiCardProps = {
  label: string;
  value: number;
  hint?: string;
  variant?: 'default' | 'warning';
};

function KpiCard({ label, value, hint, variant = 'default' }: KpiCardProps) {
  const valueClass =
    variant === 'warning' ? 'text-[--color-warning]' : 'text-[--color-text]';

  return (
    <div className="rounded-lg border border-[--color-border] bg-[--color-bg] p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-[--color-text-muted]">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
      {hint && <p className="mt-1 text-[10px] text-[--color-text-muted]">{hint}</p>}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
    >
      {Array.from({ length: 5 }).map((_, i) => (
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
