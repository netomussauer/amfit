import { DashboardFinanceiroKpis, MensalidadesTable } from '@/features/financeiro';

export const metadata = {
  title: 'Financeiro — AMFIT',
};

export default function FinanceiroPage() {
  return (
    <div className="max-w-5xl space-y-8">
      <h1 className="text-2xl font-bold text-[--color-text]">Financeiro</h1>
      <DashboardFinanceiroKpis />
      <div>
        <h2 className="mb-4 text-lg font-semibold text-[--color-text]">Mensalidades</h2>
        <MensalidadesTable />
      </div>
    </div>
  );
}
