import Link from 'next/link';
import { ExercicioGrid } from '@/features/exercicios/components/ExercicioGrid';

export const metadata = {
  title: 'Exercícios — AMFIT',
};

export default function ExerciciosPage() {
  return (
    <div className="space-y-6">
      <nav aria-label="breadcrumb" className="text-sm text-[--color-text-muted]">
        <ol className="flex items-center gap-2">
          <li className="text-[--color-text]">Exercícios</li>
        </ol>
      </nav>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[--color-text]">
            Biblioteca de Exercícios
          </h1>
          <p className="mt-1 text-sm text-[--color-text-muted]">
            Catálogo de exercícios globais e seus exercícios customizados.
          </p>
        </div>
        <Link
          href="/exercicios/novo"
          className="inline-flex items-center justify-center rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[--color-primary-hover]"
        >
          Novo exercício
        </Link>
      </header>

      <ExercicioGrid />
    </div>
  );
}
