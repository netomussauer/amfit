import { DashboardKpis } from '@/features/progresso/components/DashboardKpis';

export const metadata = {
  title: 'Dashboard — AMFIT',
};

export default function DashboardPage() {
  return (
    <div className="max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[--color-text]">Dashboard</h1>
        <p className="mt-1 text-sm text-[--color-text-muted]">
          Visão geral dos seus alunos e sessões.
        </p>
      </header>

      <DashboardKpis />
    </div>
  );
}
