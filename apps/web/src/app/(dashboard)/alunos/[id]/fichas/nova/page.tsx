import Link from 'next/link';
import { FichaForm } from '@/features/fichas/components/FichaForm';

type Props = {
  params: { id: string };
};

export const metadata = {
  title: 'Nova ficha — AMFIT',
};

export default function NovaFichaPage({ params }: Props) {
  const alunoId = params.id;

  return (
    <div className="max-w-2xl space-y-6">
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
              href={`/alunos/${alunoId}`}
              className="hover:text-[--color-primary]"
            >
              Aluno
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>Fichas</li>
          <li aria-hidden="true">/</li>
          <li className="text-[--color-text]">Nova</li>
        </ol>
      </nav>

      <header>
        <h1 className="text-2xl font-bold text-[--color-text]">Nova ficha</h1>
        <p className="mt-1 text-sm text-[--color-text-muted]">
          Crie a ficha para depois adicionar treinos e exercícios.
        </p>
      </header>

      <div className="rounded-lg border border-[--color-border] bg-[--color-bg] p-6 shadow-sm">
        <FichaForm mode="create" alunoId={alunoId} />
      </div>
    </div>
  );
}
