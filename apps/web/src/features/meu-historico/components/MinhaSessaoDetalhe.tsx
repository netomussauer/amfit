'use client';

import Link from 'next/link';
import type {
  ItemTreinoResponse,
  RegistroSerieResponse,
} from '@amfit/shared';
import { useMinhaSessao } from '../hooks/useMinhaSessao';
import { formatDataIso, formatDuracao, statusVisual } from '../lib/format';

type Props = {
  sessaoId: string;
};

export function MinhaSessaoDetalhe({ sessaoId }: Props) {
  const { data: sessao, isLoading, isError, refetch } = useMinhaSessao(sessaoId);

  if (isLoading) {
    return (
      <p className="text-sm text-[--color-text-muted]">Carregando sessão...</p>
    );
  }

  if (isError || !sessao) {
    return (
      <div>
        <p role="alert" className="text-sm text-[--color-danger]">
          Não foi possível carregar esta sessão.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 rounded-md border border-[--color-border] px-3 py-1.5 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const status = statusVisual(sessao.status);
  const duracao = formatDuracao(sessao.iniciado_em, sessao.concluido_em);
  const seriesConcluidas = sessao.series.filter((s) => s.concluida).length;
  const cargaTotal = calcularCargaTotal(sessao.series);

  const treinoLabel = sessao.treino
    ? `Treino ${sessao.treino.letra}${sessao.treino.nome ? ` — ${sessao.treino.nome}` : ''}`
    : 'Treino executado';

  return (
    <div className="space-y-6">
      <nav aria-label="breadcrumb" className="text-sm text-[--color-text-muted]">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/historico" className="hover:text-[--color-primary]">
              Histórico
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[--color-text]">
            {formatDataIso(sessao.data_execucao)}
          </li>
        </ol>
      </nav>

      <header className="flex flex-col gap-3 border-b border-[--color-border] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[--color-text]">
            {treinoLabel}
          </h1>
          <p className="text-sm text-[--color-text-muted]">
            Executado em {formatDataIso(sessao.data_execucao)}
          </p>
        </div>
        <span
          className={[
            'self-start rounded-full px-3 py-1 text-sm font-medium',
            status.className,
          ].join(' ')}
        >
          {status.label}
        </span>
      </header>

      <section
        aria-labelledby="metricas-heading"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <h2 id="metricas-heading" className="sr-only">
          Métricas da sessão
        </h2>
        <MetricCard
          label="Séries concluídas"
          value={`${seriesConcluidas}/${sessao.series.length}`}
        />
        <MetricCard
          label="Carga total movimentada"
          value={`${formatNumero(cargaTotal)} kg`}
          hint="Soma de carga × repetições por série concluída"
        />
        <MetricCard label="Duração" value={duracao ?? '—'} />
      </section>

      <section aria-labelledby="exercicios-heading" className="space-y-4">
        <h2
          id="exercicios-heading"
          className="text-lg font-semibold text-[--color-text]"
        >
          Exercícios executados
        </h2>

        {sessao.treino && sessao.treino.itens.length > 0 ? (
          <ul className="space-y-4" aria-label="Lista de exercícios da sessão">
            {sessao.treino.itens.map((item) => (
              <li key={item.id}>
                <ExercicioBlock item={item} series={sessao.series} />
              </li>
            ))}
          </ul>
        ) : (
          <SemTreinoExpandido series={sessao.series} />
        )}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[--color-border] bg-[--color-bg] p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-[--color-text-muted]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-[--color-text]">{value}</p>
      {hint && (
        <p className="mt-1 text-[10px] text-[--color-text-muted]">{hint}</p>
      )}
    </div>
  );
}

function ExercicioBlock({
  item,
  series,
}: {
  item: ItemTreinoResponse;
  series: RegistroSerieResponse[];
}) {
  const seriesDoExercicio = series
    .filter((s) => s.item_treino_id === item.id)
    .sort((a, b) => a.numero_serie - b.numero_serie);

  return (
    <article className="rounded-lg border border-[--color-border] bg-[--color-bg] shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-[--color-border] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-[--color-text]">
            {item.exercicio.nome}
          </h3>
          {item.exercicio.grupo_muscular?.nome && (
            <p className="text-xs text-[--color-text-muted]">
              {item.exercicio.grupo_muscular.nome}
            </p>
          )}
        </div>
        <Link
          href={`/progresso/${item.exercicio.id}`}
          className="text-xs font-medium text-[--color-primary] hover:text-[--color-primary-hover]"
        >
          Ver evolução
        </Link>
      </header>

      {seriesDoExercicio.length === 0 ? (
        <p className="px-4 py-4 text-xs text-[--color-text-muted]">
          Nenhuma série registrada para este exercício.
        </p>
      ) : (
        <table
          className="w-full divide-y divide-[--color-border]"
          aria-label={`Séries de ${item.exercicio.nome}`}
        >
          <thead className="bg-[--color-bg-subtle]">
            <tr>
              <Th>#</Th>
              <Th>Carga</Th>
              <Th>Reps</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[--color-border]">
            {seriesDoExercicio.map((serie) => (
              <SerieRow
                key={serie.id}
                serie={serie}
                cargaSugerida={item.carga_sugerida ?? null}
                repsSugeridas={item.repeticoes}
              />
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}

function SerieRow({
  serie,
  cargaSugerida,
  repsSugeridas,
}: {
  serie: RegistroSerieResponse;
  cargaSugerida: number | null;
  repsSugeridas: string;
}) {
  const naoConcluida = !serie.concluida;
  const cargaRealizada = serie.carga_realizada ?? null;
  const repsRealizadas = serie.repeticoes_realizadas ?? null;

  const diff =
    cargaSugerida !== null && cargaRealizada !== null
      ? cargaRealizada - cargaSugerida
      : null;

  return (
    <tr className={naoConcluida ? 'bg-[--color-bg-subtle]/40' : undefined}>
      <td className="px-4 py-3 text-sm font-medium text-[--color-text]">
        {serie.numero_serie}
      </td>
      <td className="px-4 py-3 text-sm text-[--color-text]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[--color-text-muted]">
            {cargaSugerida !== null ? `${formatNumero(cargaSugerida)} kg` : '—'}
          </span>
          <span aria-hidden="true" className="text-[--color-text-muted]">
            →
          </span>
          {naoConcluida || cargaRealizada === null ? (
            <span className="text-[--color-text-muted]">0</span>
          ) : (
            <span className="font-medium text-[--color-text]">
              {formatNumero(cargaRealizada)} kg
            </span>
          )}
          {!naoConcluida && diff !== null && diff > 0 && (
            <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-[--color-success]">
              +{formatNumero(diff)}kg
            </span>
          )}
          {!naoConcluida && diff !== null && diff < 0 && (
            <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-[--color-danger]">
              {formatNumero(diff)}kg
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-[--color-text]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[--color-text-muted]">{repsSugeridas}</span>
          <span aria-hidden="true" className="text-[--color-text-muted]">
            →
          </span>
          {naoConcluida || repsRealizadas === null ? (
            <span className="text-[--color-text-muted]">0</span>
          ) : (
            <span className="font-medium text-[--color-text]">
              {repsRealizadas}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={[
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            naoConcluida
              ? 'bg-slate-100 text-[--color-text-muted]'
              : 'bg-green-50 text-[--color-success]',
          ].join(' ')}
        >
          {naoConcluida ? 'Pulada' : 'Concluída'}
        </span>
      </td>
    </tr>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]"
    >
      {children}
    </th>
  );
}

function SemTreinoExpandido({ series }: { series: RegistroSerieResponse[] }) {
  if (series.length === 0) {
    return (
      <p className="rounded-lg border border-[--color-border] bg-[--color-bg] px-4 py-6 text-center text-sm text-[--color-text-muted]">
        Nenhuma série registrada nesta sessão.
      </p>
    );
  }

  // Fallback: mostra séries agrupadas por item_treino_id quando o backend
  // ainda não populou o `treino` no detalhe.
  const grupos = new Map<string, RegistroSerieResponse[]>();
  for (const s of series) {
    const arr = grupos.get(s.item_treino_id) ?? [];
    arr.push(s);
    grupos.set(s.item_treino_id, arr);
  }

  return (
    <ul className="space-y-3" aria-label="Séries da sessão">
      {Array.from(grupos.entries()).map(([itemId, seriesGrupo]) => (
        <li
          key={itemId}
          className="rounded-md border border-[--color-border] bg-[--color-bg] p-4 shadow-sm"
        >
          <p className="text-xs font-medium text-[--color-text-muted]">
            Exercício
          </p>
          <p className="mt-1 text-sm text-[--color-text]">
            {seriesGrupo.length} série{seriesGrupo.length > 1 ? 's' : ''} —{' '}
            {seriesGrupo.filter((s) => s.concluida).length} concluída
            {seriesGrupo.filter((s) => s.concluida).length === 1 ? '' : 's'}
          </p>
        </li>
      ))}
    </ul>
  );
}

function calcularCargaTotal(series: RegistroSerieResponse[]): number {
  return series.reduce((acc, s) => {
    if (!s.concluida) return acc;
    const carga = s.carga_realizada ?? 0;
    const reps = s.repeticoes_realizadas ?? 0;
    return acc + carga * reps;
  }, 0);
}

function formatNumero(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}
