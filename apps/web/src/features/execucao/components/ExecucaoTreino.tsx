'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, X } from 'lucide-react';
import type { AxiosError } from 'axios';
import type { RegistrarSerieRequest } from '@amfit/shared';
import { useSessao } from '../hooks/useSessao';
import { useRegistrarSerie } from '../hooks/useRegistrarSerie';
import { useConcluirSessao } from '../hooks/useConcluirSessao';
import { ExercicioBlock } from './ExercicioBlock';
import { RestTimer } from './RestTimer';

const PERCENTUAL_MINIMO_CONCLUSAO = 0.5;

type Props = {
  sessaoId: string;
};

export function ExecucaoTreino({ sessaoId }: Props) {
  const router = useRouter();

  const sessaoQuery = useSessao(sessaoId);
  const registrarSerie = useRegistrarSerie(sessaoId);
  const concluirSessao = useConcluirSessao(sessaoId);

  const [restTimerSegundos, setRestTimerSegundos] = useState<number | null>(null);
  const [concluirError, setConcluirError] = useState<string | null>(null);

  const sessao = sessaoQuery.data;
  // O backend popula `treino` no GET /sessoes/:id — evita uma segunda
  // chamada para /alunos/me/ficha só para achar o treino correspondente.
  const treino = sessao?.treino ?? null;

  const totalSeries = useMemo(() => {
    if (!treino) return 0;
    return treino.itens.reduce((acc, item) => acc + item.series, 0);
  }, [treino]);

  const seriesConcluidas = useMemo(() => {
    if (!sessao) return 0;
    return sessao.series.filter((s) => s.concluida).length;
  }, [sessao]);

  const progresso = totalSeries === 0 ? 0 : seriesConcluidas / totalSeries;
  const progressoPercentual = Math.min(100, Math.max(0, progresso * 100));

  function handleRegistrarSerie(input: {
    numero_serie: number;
    item_treino_id: string;
    concluida: boolean;
    carga_realizada: number | null;
    repeticoes_realizadas: number | null;
  }) {
    const body: RegistrarSerieRequest = {
      item_treino_id: input.item_treino_id,
      numero_serie: input.numero_serie,
      concluida: input.concluida,
      carga_realizada: input.carga_realizada,
      repeticoes_realizadas: input.repeticoes_realizadas,
    };

    registrarSerie.mutate(body);

    if (input.concluida && treino) {
      const item = treino.itens.find((i) => i.id === input.item_treino_id);
      const descanso = item?.descanso_segundos;
      if (descanso && descanso > 0) {
        setRestTimerSegundos(descanso);
      }
    }
  }

  function handleConcluir() {
    const confirmado = window.confirm(
      'Tem certeza? Séries não marcadas serão consideradas puladas.',
    );
    if (!confirmado) return;

    setConcluirError(null);
    concluirSessao.mutate(undefined, {
      onSuccess: () => {
        router.push(`/treino/concluido/${sessaoId}`);
      },
      onError: (err: AxiosError) => {
        const detail =
          (err.response?.data as { detail?: string } | undefined)?.detail ?? null;
        setConcluirError(detail ?? 'Não foi possível concluir o treino. Tente novamente.');
      },
    });
  }

  if (sessaoQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div
          aria-hidden="true"
          className="h-10 w-10 animate-spin rounded-full border-4 border-[--color-bg-muted] border-t-[--color-primary]"
        />
        <p className="mt-3 text-sm text-[--color-text-muted]">Carregando treino...</p>
      </div>
    );
  }

  if (sessaoQuery.isError || !sessao) {
    return (
      <ErroCarregarSessao
        onRetry={() => void sessaoQuery.refetch()}
      />
    );
  }

  if (!treino) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <AlertTriangle aria-hidden="true" className="h-10 w-10 text-[--color-danger]" />
        <p className="max-w-sm text-sm font-medium text-[--color-danger]">
          O treino desta sessão não foi encontrado.
        </p>
        <Link
          href="/treino"
          className="rounded-lg border border-[--color-border] px-4 py-2 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
        >
          Voltar
        </Link>
      </div>
    );
  }

  const podeConcluir = progresso >= PERCENTUAL_MINIMO_CONCLUSAO;

  return (
    <div className="flex flex-col gap-4">
      {/* Header sticky com progresso */}
      <div className="sticky top-0 z-10 -mx-6 border-b border-[--color-border] bg-[--color-bg] px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/treino"
            aria-label="Sair sem concluir o treino"
            title="Sair sem concluir o treino"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[--color-text] transition-colors hover:bg-[--color-bg-muted]"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-[--color-text]">
              Treino {treino.letra}
              {treino.nome ? ` · ${treino.nome}` : ''}
            </h1>
            <p className="text-xs text-[--color-text-muted]">
              {seriesConcluidas} de {totalSeries} séries
            </p>
          </div>
        </div>

        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-[--color-bg-muted]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalSeries}
          aria-valuenow={seriesConcluidas}
        >
          <div
            className="h-1.5 rounded-full bg-[--color-primary] transition-all duration-500 ease-out"
            style={{ width: `${progressoPercentual}%` }}
          />
        </div>
      </div>

      {/* Exercícios */}
      <div className="space-y-3 pb-24">
        {treino.itens.map((item) => {
          const registros = sessao.series.filter((s) => s.item_treino_id === item.id);
          return (
            <ExercicioBlock
              key={item.id}
              item={item}
              registros={registros}
              onRegistrarSerie={handleRegistrarSerie}
            />
          );
        })}
      </div>

      {/* Footer sticky */}
      <div className="sticky bottom-0 -mx-6 border-t border-[--color-border] bg-[--color-bg] px-6 py-4">
        {concluirError && (
          <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-[--color-danger]">
            {concluirError}
          </p>
        )}

        <button
          type="button"
          onClick={handleConcluir}
          disabled={!podeConcluir || concluirSessao.isPending}
          aria-disabled={!podeConcluir}
          aria-busy={concluirSessao.isPending}
          className={[
            'w-full rounded-lg py-4 text-base font-semibold text-white transition-colors',
            podeConcluir
              ? 'bg-[--color-primary] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
              : 'cursor-not-allowed bg-[--color-bg-muted] text-[--color-text-muted]',
          ].join(' ')}
        >
          {concluirSessao.isPending ? 'Concluindo...' : 'Concluir treino'}
          {!podeConcluir && (
            <span className="mt-0.5 block text-[11px] font-normal">
              Marque ao menos {Math.ceil(totalSeries * PERCENTUAL_MINIMO_CONCLUSAO)} séries
            </span>
          )}
        </button>
      </div>

      <RestTimer
        visible={restTimerSegundos !== null}
        duracaoSegundos={restTimerSegundos ?? 0}
        onComplete={() => setRestTimerSegundos(null)}
        onSkip={() => setRestTimerSegundos(null)}
      />
    </div>
  );
}

function ErroCarregarSessao({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <AlertTriangle aria-hidden="true" className="h-10 w-10 text-[--color-danger]" />
      <p role="alert" className="max-w-sm text-sm font-medium text-[--color-danger]">
        Não foi possível carregar este treino.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-[--color-primary] px-4 py-2 text-sm font-medium text-white"
        >
          Tentar novamente
        </button>
        <Link
          href="/treino"
          className="rounded-lg border border-[--color-border] px-4 py-2 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
        >
          Voltar
        </Link>
      </div>
    </div>
  );
}
