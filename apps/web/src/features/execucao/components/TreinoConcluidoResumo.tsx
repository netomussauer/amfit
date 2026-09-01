'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Clock, Dumbbell, ListChecks, Trophy } from 'lucide-react';
import type { RegistroSerieResponse } from '@amfit/shared';
import { useSessao } from '../hooks/useSessao';

type Props = {
  sessaoId: string;
};

function formatDuracao(
  iniciadoEm: string,
  concluidoEm: string | null | undefined,
): string {
  if (!concluidoEm) return '—';
  const start = new Date(iniciadoEm).getTime();
  const end = new Date(concluidoEm).getTime();
  const diffMin = Math.max(0, Math.round((end - start) / 60000));
  if (diffMin < 60) return `${diffMin} min`;
  const horas = Math.floor(diffMin / 60);
  const minutos = diffMin % 60;
  return `${horas}h ${minutos}min`;
}

function formatCargaTotal(kg: number): string {
  if (kg === 0) return '0 kg';
  if (kg >= 1000) return `${(kg / 1000).toFixed(1).replace('.', ',')} t`;
  return `${Number.isInteger(kg) ? kg : kg.toFixed(1).replace('.', ',')} kg`;
}

function calcularCargaTotal(series: RegistroSerieResponse[]): number {
  return series.reduce((acc, s) => {
    if (!s.concluida) return acc;
    const carga = s.carga_realizada ?? 0;
    const reps = s.repeticoes_realizadas ?? 0;
    return acc + carga * reps;
  }, 0);
}

export function TreinoConcluidoResumo({ sessaoId }: Props) {
  const { data: sessao, isLoading } = useSessao(sessaoId);
  const treino = sessao?.treino ?? null;

  const seriesConcluidas = sessao?.series.filter((s) => s.concluida).length ?? 0;
  const cargaTotal = useMemo(
    () => (sessao ? calcularCargaTotal(sessao.series) : 0),
    [sessao],
  );
  const duracao = sessao
    ? formatDuracao(sessao.iniciado_em, sessao.concluido_em)
    : '—';

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div
          aria-hidden="true"
          className="h-10 w-10 animate-spin rounded-full border-4 border-[--color-bg-muted] border-t-[--color-primary]"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-12 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[--color-primary]/10">
        <Trophy aria-hidden="true" className="h-14 w-14 text-[--color-primary]" />
      </div>

      <h1 className="mt-6 text-3xl font-bold text-[--color-text]">
        Treino concluído!
      </h1>
      {treino && (
        <p className="mt-2 text-sm text-[--color-text-muted]">
          Treino {treino.letra}
          {treino.nome ? ` · ${treino.nome}` : ''}
        </p>
      )}

      <div className="mt-8 w-full space-y-3">
        <ResumoLinha
          icon={<ListChecks aria-hidden="true" className="h-5 w-5 text-[--color-primary]" />}
          label="Séries concluídas"
          value={`${seriesConcluidas}`}
        />
        <ResumoLinha
          icon={<Dumbbell aria-hidden="true" className="h-5 w-5 text-[--color-primary]" />}
          label="Carga total movimentada"
          value={formatCargaTotal(cargaTotal)}
        />
        <ResumoLinha
          icon={<Clock aria-hidden="true" className="h-5 w-5 text-[--color-primary]" />}
          label="Duração"
          value={duracao}
        />
      </div>

      <Link
        href="/treino"
        className="mt-10 w-full rounded-lg bg-[--color-primary] py-4 text-base font-semibold text-white hover:opacity-90"
      >
        Voltar para início
      </Link>
    </div>
  );
}

function ResumoLinha({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[--color-border] bg-[--color-bg] px-4 py-3 text-left shadow-sm">
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[--color-primary]/10">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase text-[--color-text-muted]">{label}</p>
        <p className="text-base font-semibold text-[--color-text]">{value}</p>
      </div>
    </div>
  );
}
