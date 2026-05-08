import { AlunoTable } from '@/features/alunos/components/AlunoTable';

export const metadata = {
  title: 'Alunos — AMFIT',
};

export default function AlunosPage() {
  return (
    <div className="space-y-6">
      <nav aria-label="breadcrumb" className="text-sm text-[--color-text-muted]">
        <ol className="flex items-center gap-2">
          <li className="text-[--color-text]">Alunos</li>
        </ol>
      </nav>
      <header>
        <h1 className="text-2xl font-bold text-[--color-text]">Alunos</h1>
        <p className="mt-1 text-sm text-[--color-text-muted]">
          Gerencie os alunos vinculados à sua conta.
        </p>
      </header>
      <AlunoTable />
    </div>
  );
}
