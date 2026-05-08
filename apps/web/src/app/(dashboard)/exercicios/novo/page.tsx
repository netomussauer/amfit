import Link from 'next/link';
import { ExercicioForm } from '@/features/exercicios/components/ExercicioForm';

export const metadata = {
  title: 'Novo exercício — AMFIT',
};

export default function NovoExercicioPage() {
  return (
    <div className="space-y-6">
      <nav aria-label="breadcrumb" className="text-sm text-[--color-text-muted]">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/exercicios" className="hover:text-[--color-primary]">
              Exercícios
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[--color-text]">Novo</li>
        </ol>
      </nav>

      <header>
        <h1 className="text-2xl font-bold text-[--color-text]">Novo exercício</h1>
        <p className="mt-1 text-sm text-[--color-text-muted]">
          Cadastre um exercício customizado da sua biblioteca.
        </p>
      </header>

      <div className="max-w-2xl rounded-lg border border-[--color-border] bg-[--color-bg] p-6 shadow-sm">
        <ExercicioForm mode="create" />
      </div>
    </div>
  );
}
