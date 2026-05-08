'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AlunoResponse } from '@amfit/shared';
import { useAlunos } from '../hooks/useAlunos';

const PER_PAGE = 20;

export function AlunoTable() {
  const [page, setPage] = useState(1);
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useAlunos({
    page,
    perPage: PER_PAGE,
    ativo: mostrarInativos ? undefined : true,
  });

  const alunos = data?.data ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm text-[--color-text]">
          <input
            type="checkbox"
            checked={mostrarInativos}
            onChange={(e) => {
              setMostrarInativos(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-[--color-border] text-[--color-primary] focus:ring-[--color-primary]"
          />
          Mostrar inativos
        </label>

        <Link
          href="/alunos/novo"
          className="inline-flex items-center justify-center rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[--color-primary-hover]"
        >
          Novo aluno
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-[--color-border] bg-[--color-bg] shadow-sm">
        {isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-[--color-text-muted]">
            Carregando alunos...
          </p>
        ) : isError ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-[--color-danger]" role="alert">
              Não foi possível carregar a lista de alunos.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 rounded-md border border-[--color-border] px-3 py-1.5 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
            >
              Tentar novamente
            </button>
          </div>
        ) : alunos.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-[--color-text-muted]">
              Nenhum aluno encontrado.
            </p>
            <Link
              href="/alunos/novo"
              className="mt-3 inline-flex items-center rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white hover:bg-[--color-primary-hover]"
            >
              Cadastrar primeiro aluno
            </Link>
          </div>
        ) : (
          <table className="w-full divide-y divide-[--color-border]" aria-label="Lista de alunos">
            <thead className="bg-[--color-bg-subtle]">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]"
                >
                  Nome
                </th>
                <th
                  scope="col"
                  className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[--color-text-muted] md:table-cell"
                >
                  E-mail
                </th>
                <th
                  scope="col"
                  className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[--color-text-muted] lg:table-cell"
                >
                  Telefone
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]"
                >
                  Status
                </th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--color-border]">
              {alunos.map((aluno) => (
                <AlunoRow key={aluno.id} aluno={aluno} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {alunos.length > 0 && (
        <div className="flex items-center justify-between text-sm text-[--color-text-muted]">
          <span aria-live="polite">
            Página {page} de {totalPages} — {total} aluno{total !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!hasPrev || isFetching}
              className="rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-1.5 text-sm font-medium text-[--color-text] transition-colors hover:bg-[--color-bg-muted] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNext || isFetching}
              className="rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-1.5 text-sm font-medium text-[--color-text] transition-colors hover:bg-[--color-bg-muted] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AlunoRow({ aluno }: { aluno: AlunoResponse }) {
  return (
    <tr className="hover:bg-[--color-bg-subtle]">
      <td className="px-4 py-3 text-sm font-medium text-[--color-text]">
        <Link href={`/alunos/${aluno.id}`} className="hover:text-[--color-primary]">
          {aluno.nome}
        </Link>
      </td>
      <td className="hidden px-4 py-3 text-sm text-[--color-text-muted] md:table-cell">
        {aluno.email}
      </td>
      <td className="hidden px-4 py-3 text-sm text-[--color-text-muted] lg:table-cell">
        {aluno.telefone ?? '—'}
      </td>
      <td className="px-4 py-3">
        <span
          className={[
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            aluno.ativo
              ? 'bg-green-50 text-[--color-success]'
              : 'bg-slate-100 text-[--color-text-muted]',
          ].join(' ')}
        >
          {aluno.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/alunos/${aluno.id}`}
          className="text-sm font-medium text-[--color-primary] hover:text-[--color-primary-hover]"
        >
          Ver
        </Link>
      </td>
    </tr>
  );
}
