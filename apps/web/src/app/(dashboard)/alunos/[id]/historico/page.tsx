import Link from 'next/link';
import { SessoesTable } from '@/features/sessoes/components/SessoesTable';

type Props = {
  params: { id: string };
};

export const metadata = {
  title: 'Histórico de sessões — AMFIT',
};

export default function HistoricoSessoesPage({ params }: Props) {
  const { id } = params;

  return (
    <div className="max-w-5xl space-y-6">
      <nav aria-label="breadcrumb" className="text-sm text-[--color-text-muted]">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/alunos" className="hover:text-[--color-primary]">
              Alunos
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/alunos/${id}`}
              className="hover:text-[--color-primary]"
            >
              Aluno
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[--color-text]">Histórico</li>
        </ol>
      </nav>

      <header className="flex flex-col gap-1 border-b border-[--color-border] pb-4">
        <h1 className="text-2xl font-bold text-[--color-text]">
          Histórico de Sessões
        </h1>
        <p className="text-sm text-[--color-text-muted]">
          Todas as sessões executadas pelo aluno.
        </p>
      </header>

      <SessoesTable alunoId={id} />
    </div>
  );
}
