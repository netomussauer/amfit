'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAluno } from '@/features/alunos/hooks/useAluno';
import { useExercicio } from '@/features/exercicios/hooks/useExercicio';
import { calcularDataInicio } from '@amfit/shared';
import { useHistoricoExercicio } from '../hooks/useHistoricoExercicio';
import { buildEvolucaoCarga, formatDataIso, formatNumero } from '../lib/chart-data';
import { EvolucaoCargaChart } from './EvolucaoCargaChart';

type Props = {
  alunoId: string;
  exercicioId: string;
};

type RangeOption = '30' | '90' | 'todos';

const RANGE_OPTIONS: { value: RangeOption; label: string }[] = [
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: 'todos', label: 'Todo o período' },
];

function calcularFrom(range: RangeOption): string | undefined {
  if (range === 'todos') return undefined;
  return calcularDataInicio(range === '30' ? 30 : 90);
}

export function ProgressoExercicio({ alunoId, exercicioId }: Props) {
  const [range, setRange] = useState<RangeOption>('90');

  const { data: aluno } = useAluno(alunoId);
  const { data: exercicio } = useExercicio(exercicioId);

  const from = useMemo(() => calcularFrom(range), [range]);

  const {
    data: historico,
    isLoading,
    isError,
    refetch,
  } = useHistoricoExercicio({ alunoId, exercicioId, from });

  const evolucao = useMemo(
    () => buildEvolucaoCarga(historico?.pontos ?? []),
    [historico],
  );

  return (
    <div className="space-y-6">
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
              {aluno?.nome ?? 'Aluno'}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[--color-text]">Evolução de carga</li>
        </ol>
      </nav>

      <header className="border-b border-[--color-border] pb-4">
        <h1 className="text-2xl font-bold text-[--color-text]">
          {exercicio?.nome ?? 'Evolução de carga'}
        </h1>
        <p className="text-sm text-[--color-text-muted]">
          Progressão de carga de {aluno?.nome ?? 'aluno'} neste exercício.
        </p>
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
            onClick={() => setRange(option.value)}
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
            Não foi possível carregar o histórico deste exercício.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
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
              className="mb-2 text-sm font-semibold text-[--color-text]"
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
