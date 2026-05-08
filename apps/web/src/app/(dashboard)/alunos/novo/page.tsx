import Link from 'next/link';
import { AlunoForm } from '@/features/alunos/components/AlunoForm';

export const metadata = {
  title: 'Novo aluno — AMFIT',
};

export default function NovoAlunoPage() {
  return (
    <div className="space-y-6">
      <nav aria-label="breadcrumb" className="text-sm text-[--color-text-muted]">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/alunos" className="hover:text-[--color-primary]">
              Alunos
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[--color-text]">Novo</li>
        </ol>
      </nav>

      <header>
        <h1 className="text-2xl font-bold text-[--color-text]">Novo aluno</h1>
        <p className="mt-1 text-sm text-[--color-text-muted]">
          Preencha os dados para cadastrar um novo aluno.
        </p>
      </header>

      <div className="max-w-2xl rounded-lg border border-[--color-border] bg-[--color-bg] p-6 shadow-sm">
        <AlunoForm mode="create" />
      </div>
    </div>
  );
}
