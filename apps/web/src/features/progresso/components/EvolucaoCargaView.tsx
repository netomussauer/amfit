'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { calcularDataInicio } from '@amfit/shared';
import type { EvolucaoCargaPoint } from '../lib/chart-data';
import { formatDataIso, formatNumero } from '../lib/chart-data';
import { EvolucaoCargaChart } from './EvolucaoCargaChart';

export type RangeOption = '30' | '90' | 'todos';

export const RANGE_OPTIONS: { value: RangeOption; label: string }[] = [
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: 'todos', label: 'Todo o período' },
];

export function calcularFrom(range: RangeOption): string | undefined {
  if (range === 'todos') return undefined;
  return calcularDataInicio(range === '30' ? 30 : 90);
}

type Breadcrumb = { href: string; label: string };

type Props = {
  breadcrumb: Breadcrumb[];
  titulo: string;
  subtitulo: string;
  range: RangeOption;
  onRangeChange: (range: RangeOption) => void;
  isLoading: boolean;
  isError: boolean;
  mensagemErro: string;
  onRetry: () => void;
  evolucao: EvolucaoCargaPoint[];
};

/**
 * Parte visual (breadcrumb, filtro de período, gráfico e tabela agregada) de
 * "Evolução de carga", compartilhada entre a visão do personal
 * (ProgressoExercicio, que navega a partir de /alunos) e a do próprio aluno
 * (MeuProgressoExercicio, a partir de /historico) — as únicas diferenças
 * reais entre as duas são o breadcrumb, os textos de subtítulo/erro e qual
 * hook busca os dados, então cada uma vira um wrapper fino em cima deste
 * componente em vez de duplicar toda a árvore de JSX.
 */
export function EvolucaoCargaView({
  breadcrumb,
  titulo,
  subtitulo,
  range,
  onRangeChange,
  isLoading,
  isError,
  mensagemErro,
  onRetry,
  evolucao,
}: Props) {
  return (
    <div className="space-y-6">
      <nav aria-label="breadcrumb" className="text-sm text-[--color-text-muted]">
        <ol className="flex flex-wrap items-center gap-2">
          {breadcrumb.map((item) => (
            <Fragment key={item.href}>
              <li>
                <Link href={item.href} className="hover:text-[--color-primary]">
                  {item.label}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
            </Fragment>
          ))}
          <li className="text-[--color-text]">Evolução de carga</li>
        </ol>
      </nav>

      <header className="border-b border-[--color-border] pb-4">
        <h1 className="text-2xl font-bold text-[--color-text]">{titulo}</h1>
        <p className="text-sm text-[--color-text-muted]">{subtitulo}</p>
      </header>

      <div
        role="radiogroup"
        aria-label="Período de análise"
        className="flex flex-wrap gap-2"
      >
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={range === option.value}
            onClick={() => onRangeChange(option.value)}
            className={[
              'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              range === option.value
                ? 'border-[--color-primary] bg-[--color-primary] text-white'
                : 'border-[--color-border] bg-[--color-bg] text-[--color-text] hover:bg-[--color-bg-muted]',
            ].join(' ')}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div
          aria-hidden="true"
          className="h-72 w-full animate-pulse rounded-lg border border-[--color-border] bg-[--color-bg-muted]"
        />
      ) : isError ? (
        <div className="rounded-lg border border-[--color-border] bg-[--color-bg] px-4 py-12 text-center shadow-sm">
          <p role="alert" className="text-sm text-[--color-danger]">
            {mensagemErro}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-md border border-[--color-border] px-3 py-1.5 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
          >
            Tentar novamente
          </button>
        </div>
      ) : evolucao.length === 0 ? (
        <div className="rounded-lg border border-[--color-border] bg-[--color-bg] px-4 py-12 text-center shadow-sm">
          <p className="text-sm text-[--color-text-muted]">
            Nenhum registro de carga para este exercício no período selecionado.
          </p>
        </div>
      ) : (
        <>
          <EvolucaoCargaChart pontos={evolucao} />

          <section aria-labelledby="tabela-evolucao-heading">
            <h2
              id="tabela-evolucao-heading"
              className="mb-2 font-sans text-sm font-semibold text-[--color-text]"
            >
              Dados por sessão
            </h2>
            <div className="overflow-hidden rounded-lg border border-[--color-border] bg-[--color-bg] shadow-sm">
              <table
                className="w-full divide-y divide-[--color-border]"
                aria-label="Evolução de carga por sessão"
              >
                <thead className="bg-[--color-bg-subtle]">
                  <tr>
                    <Th>Data</Th>
                    <Th>Carga máxima</Th>
                    <Th className="hidden sm:table-cell">Volume total</Th>
                    <Th className="hidden sm:table-cell">Séries registradas</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--color-border]">
                  {evolucao.map((ponto) => (
                    <tr key={ponto.sessaoId}>
                      <td className="px-4 py-3 text-sm font-medium text-[--color-text]">
                        {formatDataIso(ponto.data)}
                      </td>
                      <td className="px-4 py-3 text-sm text-[--color-text]">
                        {ponto.cargaMaxima !== null
                          ? `${formatNumero(ponto.cargaMaxima)} kg`
                          : '—'}
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-[--color-text-muted] sm:table-cell">
                        {formatNumero(ponto.volumeTotal)} kg
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-[--color-text-muted] sm:table-cell">
                        {ponto.totalSeries}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
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
