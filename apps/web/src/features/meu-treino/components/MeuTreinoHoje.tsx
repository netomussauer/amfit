'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import type { AxiosError } from 'axios';
import { useIniciarSessao } from '@/features/execucao/hooks/useIniciarSessao';
import { useTreinoHoje } from '../hooks/useTreinoHoje';
import { useMinhaFicha } from '../hooks/useMinhaFicha';
import { TreinoHojeCard } from './TreinoHojeCard';
import { EmptyTreinoState } from './EmptyTreinoState';
import { TreinoSkeleton } from './TreinoSkeleton';

export function MeuTreinoHoje() {
  const router = useRouter();
  const [iniciarError, setIniciarError] = useState<string | null>(null);

  const treinoQuery = useTreinoHoje();
  // Só usada para diferenciar "sem ficha ativa" de "ficha ativa, sem treino hoje"
  // quando o treino de hoje vem nulo — o backend devolve 204 nos dois casos.
  const fichaQuery = useMinhaFicha();
  const iniciarMutation = useIniciarSessao();

  const treino = treinoQuery.data?.treino ?? null;
  const sessaoHojeId = treinoQuery.data?.sessao_hoje_id ?? null;

  async function handleIniciar() {
    if (!treino) return;
    setIniciarError(null);
    try {
      const sessao = await iniciarMutation.mutateAsync({ treino_id: treino.id });
      router.push(`/treino/${sessao.id}`);
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      setIniciarError(
        axiosErr.response?.data?.detail ?? 'Não foi possível iniciar o treino.',
      );
    }
  }

  function handleContinuar() {
    if (!sessaoHojeId) return;
    router.push(`/treino/${sessaoHojeId}`);
  }

  const podeIniciar = treino !== null && !iniciarMutation.isPending;
  const continuarMode = sessaoHojeId !== null;

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[--color-text]">Treino de hoje</h1>
        <p className="mt-1 text-sm text-[--color-text-muted]">
          Confira os exercícios do dia e inicie sua sessão de treino.
        </p>
      </header>

      <div>
        {treinoQuery.isLoading ? (
          <TreinoSkeleton />
        ) : treinoQuery.isError ? (
          <ErroTreinoHoje onRetry={() => void treinoQuery.refetch()} />
        ) : treino ? (
          <TreinoHojeCard treino={treino} />
        ) : (
          <ConteudoSemTreino
            fichaLoading={fichaQuery.isLoading}
            temFichaAtiva={!!fichaQuery.data}
            fichaErroInesperado={
              fichaQuery.isError && fichaQuery.error.response?.status !== 404
            }
            onRetryFicha={() => void fichaQuery.refetch()}
          />
        )}
      </div>

      {treino && (
        <div>
          <button
            type="button"
            onClick={continuarMode ? handleContinuar : handleIniciar}
            disabled={!podeIniciar}
            aria-busy={iniciarMutation.isPending}
            className={[
              'w-full rounded-lg py-4 text-base font-semibold text-white transition-colors',
              podeIniciar
                ? 'bg-[--color-primary] hover:opacity-90'
                : 'cursor-not-allowed bg-[--color-bg-muted] text-[--color-text-muted]',
            ].join(' ')}
          >
            {iniciarMutation.isPending
              ? 'Iniciando...'
              : continuarMode
                ? 'Continuar treino'
                : 'Iniciar treino'}
            {continuarMode && (
              <span className="mt-0.5 block text-xs font-normal text-white/80">
                Você tem uma sessão em andamento
              </span>
            )}
          </button>

          {iniciarError && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-[--color-danger]"
            >
              {iniciarError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ConteudoSemTreino({
  fichaLoading,
  temFichaAtiva,
  fichaErroInesperado,
  onRetryFicha,
}: {
  fichaLoading: boolean;
  temFichaAtiva: boolean;
  fichaErroInesperado: boolean;
  onRetryFicha: () => void;
}) {
  if (fichaLoading) {
    return <TreinoSkeleton />;
  }

  if (fichaErroInesperado) {
    return <ErroTreinoHoje onRetry={onRetryFicha} />;
  }

  if (temFichaAtiva) {
    return (
      <EmptyTreinoState
        title="Sem treino agendado para hoje"
        description="Sua ficha está ativa, mas não há treino previsto para hoje. Aproveite para descansar ou confira sua ficha completa."
      />
    );
  }

  return (
    <EmptyTreinoState
      title="Nenhuma ficha ativa"
      description="Quando seu personal liberar uma ficha de treino, ela aparecerá aqui."
    />
  );
}

function ErroTreinoHoje({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-lg border border-red-200 bg-red-50 px-6 py-10 text-center"
    >
      <AlertTriangle aria-hidden="true" className="h-10 w-10 text-[--color-danger]" />
      <p className="mt-3 text-base font-medium text-[--color-danger]">
        Não foi possível carregar seu treino
      </p>
      <p className="mt-1 text-sm text-[--color-danger]">
        Verifique sua conexão e tente novamente.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-lg bg-[--color-primary] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Tentar novamente
      </button>
    </div>
  );
}
