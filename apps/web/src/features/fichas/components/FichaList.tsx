'use client';

import Link from 'next/link';
import type { FichaResponse } from '@amfit/shared';
import { useFichas } from '../hooks/useFichas';

type Props = {
  alunoId: string;
};

export function FichaList({ alunoId }: Props) {
  const { data, isLoading, isError, refetch } = useFichas({ aluno_id: alunoId });
  const fichas = data?.data ?? [];

  return (
    <section
      aria-labelledby="fichas-heading"
      className="space-y-4"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="fichas-heading"
            className="text-lg font-semibold text-[--color-text]"
          >
            Fichas de treino
          </h2>
          <p className="text-sm text-[--color-text-muted]">
            Gerencie as fichas vinculadas a este aluno.
          </p>
        </div>
        <Link
          href={`/alunos/${alunoId}/fichas/nova`}
          className="inline-flex items-center justify-center rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[--color-primary-hover]"
        >
          Nova ficha
        </Link>
      </header>

      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <div className="rounded-lg border border-[--color-border] bg-[--color-bg] px-4 py-8 text-center shadow-sm">
          <p role="alert" className="text-sm text-[--color-danger]">
            Não foi possível carregar as fichas.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-md border border-[--color-border] px-3 py-1.5 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
          >
            Tentar novamente
          </button>
        </div>
      ) : fichas.length === 0 ? (
        <div className="rounded-lg border border-[--color-border] bg-[--color-bg] px-4 py-12 text-center shadow-sm">
          <p className="text-sm text-[--color-text-muted]">
            Nenhuma ficha cadastrada para este aluno.
          </p>
          <Link
            href={`/alunos/${alunoId}/fichas/nova`}
            className="mt-3 inline-flex items-center rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white hover:bg-[--color-primary-hover]"
          >
            Criar primeira ficha
          </Link>
        </div>
      ) : (
        <ul
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
          aria-label="Lista de fichas"
        >
          {fichas.map((ficha) => (
            <li key={ficha.id}>
              <FichaCard ficha={ficha} alunoId={alunoId} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FichaCard({
  ficha,
  alunoId,
}: {
  ficha: FichaResponse;
  alunoId: string;
}) {
  const totalTreinos = ficha.treinos.length;

  return (
    <Link
      href={`/alunos/${alunoId}/fichas/${ficha.id}`}
      className="group flex h-full flex-col gap-3 rounded-lg border border-[--color-border] bg-[--color-bg] p-4 shadow-sm transition-colors hover:border-[--color-primary] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary]"
      aria-label={`Abrir ficha ${ficha.nome}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-[--color-text] group-hover:text-[--color-primary]">
          {ficha.nome}
        </h3>
        <StatusBadge ativa={ficha.ativa} />
      </div>

      <dl className="space-y-1 text-xs text-[--color-text-muted]">
        <div className="flex items-center gap-1">
          <dt className="font-medium">Vigência:</dt>
          <dd>
            {formatDate(ficha.vigencia_inicio)}
            {ficha.vigencia_fim ? ` — ${formatDate(ficha.vigencia_fim)}` : ' — em aberto'}
          </dd>
        </div>
        <div className="flex items-center gap-1">
          <dt className="font-medium">Treinos:</dt>
          <dd>
            {totalTreinos === 0
              ? 'Nenhum cadastrado'
              : `${totalTreinos} treino${totalTreinos > 1 ? 's' : ''}`}
          </dd>
        </div>
      </dl>
    </Link>
  );
}

function StatusBadge({ ativa }: { ativa: boolean }) {
  return (
    <span
      className={[
        'inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        ativa
          ? 'bg-green-50 text-[--color-success]'
          : 'bg-slate-100 text-[--color-text-muted]',
      ].join(' ')}
    >
      {ativa ? 'Ativa' : 'Inativa'}
    </span>
  );
}

function formatDate(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-');
  if (!yyyy || !mm || !dd) return iso;
  return `${dd}/${mm}/${yyyy}`;
}

function ListSkeleton() {
  return (
    <ul
      aria-hidden="true"
      className="grid grid-cols-1 gap-3 md:grid-cols-2"
    >
      {Array.from({ length: 2 }).map((_, i) => (
        <li
          key={i}
          className="rounded-lg border border-[--color-border] bg-[--color-bg] p-4 shadow-sm"
        >
          <div className="space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-[--color-bg-muted]" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-[--color-bg-muted]" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-[--color-bg-muted]" />
          </div>
        </li>
      ))}
    </ul>
  );
}
