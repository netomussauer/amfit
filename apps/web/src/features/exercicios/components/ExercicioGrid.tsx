'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useExercicios } from '../hooks/useExercicios';
import { ExercicioCard } from './ExercicioCard';
import { FiltrosExercicio } from './FiltrosExercicio';

export function ExercicioGrid() {
  const [busca, setBusca] = useState('');
  const [grupoMuscularId, setGrupoMuscularId] = useState('');

  const buscaDebounced = useDebounce(busca, 300);

  const { data, isLoading, isError, refetch } = useExercicios({
    busca: buscaDebounced || undefined,
    grupo_muscular_id: grupoMuscularId || undefined,
  });

  const exercicios = data?.data ?? [];
  const hasFilter = !!buscaDebounced || !!grupoMuscularId;

  return (
    <div className="space-y-4">
      <FiltrosExercicio
        busca={busca}
        grupoMuscularId={grupoMuscularId}
        onBuscaChange={setBusca}
        onGrupoMuscularChange={setGrupoMuscularId}
      />

      {isLoading ? (
        <GridSkeleton />
      ) : isError ? (
        <div className="rounded-lg border border-[--color-border] bg-[--color-bg] px-4 py-12 text-center shadow-sm">
          <p role="alert" className="text-sm text-[--color-danger]">
            Não foi possível carregar os exercícios.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-md border border-[--color-border] px-3 py-1.5 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
          >
            Tentar novamente
          </button>
        </div>
      ) : exercicios.length === 0 ? (
        <div className="rounded-lg border border-[--color-border] bg-[--color-bg] px-4 py-12 text-center shadow-sm">
          <p className="text-sm text-[--color-text-muted]">
            {hasFilter
              ? 'Nenhum exercício encontrado com os filtros atuais.'
              : 'Nenhum exercício cadastrado ainda.'}
          </p>
          {!hasFilter && (
            <Link
              href="/exercicios/novo"
              className="mt-3 inline-flex items-center rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white hover:bg-[--color-primary-hover]"
            >
              Cadastrar primeiro exercício
            </Link>
          )}
        </div>
      ) : (
        <ul
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          aria-label="Lista de exercícios"
        >
          {exercicios.map((exercicio) => (
            <li key={exercicio.id} className="flex">
              <div className="flex-1">
                <ExercicioCard exercicio={exercicio} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GridSkeleton() {
  return (
    <ul
      aria-hidden="true"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <li
          key={i}
          className="overflow-hidden rounded-lg border border-[--color-border] bg-[--color-bg] shadow-sm"
        >
          <div className="aspect-video w-full animate-pulse bg-[--color-bg-muted]" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-[--color-bg-muted]" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-[--color-bg-muted]" />
            <div className="h-3 w-full animate-pulse rounded bg-[--color-bg-muted]" />
          </div>
        </li>
      ))}
    </ul>
  );
}
