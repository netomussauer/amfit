'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SessaoResumoResponse } from '@amfit/shared';
import { useSessoesPorAluno } from '../hooks/useSessoesPorAluno';
import { formatDataIso, formatDuracao, statusVisual } from '../lib/format';

const PER_PAGE = 20;

type Props = {
  alunoId: string;
};

export function SessoesTable({ alunoId }: Props) {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch, isFetching } = useSessoesPorAluno({
    alunoId,
    page,
    perPage: PER_PAGE,
  });

  const sessoes = data?.data ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-[--color-border] bg-[--color-bg] shadow-sm">
        {isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-[--color-text-muted]">
            Carregando histórico...
          </p>
        ) : isError ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-[--color-danger]" role="alert">
              Não foi possível carregar o histórico de sessões.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 rounded-md border border-[--color-border] px-3 py-1.5 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
            >
              Tentar novamente
            </button>
          </div>
        ) : sessoes.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-[--color-text-muted]">
              Este aluno ainda não executou nenhuma sessão.
            </p>
            <p className="mt-1 text-xs text-[--color-text-muted]">
              As sessões aparecem aqui assim que o aluno iniciar um treino no app.
            </p>
          </div>
        ) : (
          <table
            className="w-full divide-y divide-[--color-border]"
            aria-label="Histórico de sessões do aluno"
          >
            <thead className="bg-[--color-bg-subtle]">
              <tr>
                <Th>Data</Th>
                <Th>Treino</Th>
                <Th>Status</Th>
                <Th className="hidden md:table-cell">Progresso</Th>
                <Th className="hidden lg:table-cell">Duração</Th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--color-border]">
              {sessoes.map((sessao) => (
                <SessaoRow
                  key={sessao.id}
                  sessao={sessao}
                  alunoId={alunoId}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {sessoes.length > 0 && (
        <div className="flex items-center justify-between text-sm text-[--color-text-muted]">
          <span aria-live="polite">
            Página {page} de {totalPages} — {total} sessã{total === 1 ? 'o' : 'es'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!hasPrev || isFetching}
              aria-label="Página anterior"
              className="rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-1.5 text-sm font-medium text-[--color-text] transition-colors hover:bg-[--color-bg-muted] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNext || isFetching}
              aria-label="Próxima página"
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

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={[
        'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </th>
  );
}

function SessaoRow({
  sessao,
  alunoId,
}: {
  sessao: SessaoResumoResponse;
  alunoId: string;
}) {
  const status = statusVisual(sessao.status);
  const duracao = formatDuracao(sessao.iniciado_em, sessao.concluido_em);

  const progresso =
    sessao.total_series === 0
      ? 0
      : Math.min(100, (sessao.series_concluidas / sessao.total_series) * 100);

  return (
    <tr className="hover:bg-[--color-bg-subtle]">
      <td className="px-4 py-3 text-sm font-medium text-[--color-text]">
        {formatDataIso(sessao.data_execucao)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[--color-primary] text-xs font-bold text-white"
          >
            {sessao.treino_letra}
          </span>
          <span className="truncate text-sm text-[--color-text]">
            {sessao.treino_nome ?? `Treino ${sessao.treino_letra}`}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={[
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            status.className,
          ].join(' ')}
        >
          {status.label}
        </span>
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[--color-text-muted]">
            {sessao.series_concluidas}/{sessao.total_series} séries
          </span>
          <div
            className="h-1 w-24 overflow-hidden rounded-full bg-[--color-bg-muted]"
            role="progressbar"
            aria-valuenow={Math.round(progresso)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progresso: ${sessao.series_concluidas} de ${sessao.total_series} séries`}
          >
            <div
              className="h-full bg-[--color-primary] transition-all"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>
      </td>
      <td className="hidden px-4 py-3 text-sm text-[--color-text-muted] lg:table-cell">
        {duracao ?? '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/alunos/${alunoId}/historico/${sessao.id}`}
          className="text-sm font-medium text-[--color-primary] hover:text-[--color-primary-hover]"
        >
          Ver detalhes
        </Link>
      </td>
    </tr>
  );
}
