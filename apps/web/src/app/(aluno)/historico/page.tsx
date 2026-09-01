import { MinhasSessoesTable } from '@/features/meu-historico/components/MinhasSessoesTable';

export const metadata = {
  title: 'Histórico — AMFIT',
};

export default function HistoricoPage() {
  return (
    <div className="max-w-5xl space-y-6">
      <header className="flex flex-col gap-1 border-b border-[--color-border] pb-4">
        <h1 className="text-2xl font-bold text-[--color-text]">
          Histórico de Treinos
        </h1>
        <p className="text-sm text-[--color-text-muted]">
          Suas sessões de treino executadas.
        </p>
      </header>

      <MinhasSessoesTable />
    </div>
  );
}
