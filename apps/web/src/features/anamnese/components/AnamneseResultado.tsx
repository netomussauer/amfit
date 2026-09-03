'use client';

import type { AnamneseResponse } from '@amfit/shared';
import { NIVEL_ANAMNESE_LABEL, NIVEL_ANAMNESE_BADGE_CLASS } from '../lib/opcoes';

type Props = {
  anamnese: AnamneseResponse;
  onReavaliar: () => void;
};

type RespostaChave = keyof AnamneseResponse['respostas'];

const RESPOSTAS_LABELS: Record<RespostaChave, string> = {
  frequencia_semanal: 'Frequência de treino atual',
  experiencia_meses: 'Experiência com treino',
  objetivo: 'Objetivo principal',
  restricoes: 'Restrições médicas',
  disponibilidade: 'Disponibilidade semanal',
};

const RESPOSTAS_ORDEM: RespostaChave[] = [
  'frequencia_semanal',
  'experiencia_meses',
  'objetivo',
  'restricoes',
  'disponibilidade',
];

export function AnamneseResultado({ anamnese, onReavaliar }: Props) {
  return (
    <div className="space-y-4 rounded-lg border border-[--color-border] bg-[--color-bg] p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[--color-text]">Objetivo</p>
          <p className="text-sm text-[--color-text-muted]">{anamnese.objetivo}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[--color-text-muted]">
            Score: <strong className="text-[--color-text]">{anamnese.score_calculado}</strong>
          </span>
          <span
            className={[
              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
              NIVEL_ANAMNESE_BADGE_CLASS[anamnese.nivel_sugerido],
            ].join(' ')}
          >
            {NIVEL_ANAMNESE_LABEL[anamnese.nivel_sugerido]}
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {RESPOSTAS_ORDEM.map((chave) => (
          <div
            key={chave}
            className="flex items-center justify-between gap-2 border-b border-[--color-border] pb-1"
          >
            <dt className="text-[--color-text-muted]">{RESPOSTAS_LABELS[chave]}</dt>
            <dd className="font-medium text-[--color-text]">{anamnese.respostas[chave].opcao}</dd>
          </div>
        ))}
      </dl>

      <button
        type="button"
        onClick={onReavaliar}
        className="rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-1.5 text-sm font-medium text-[--color-text] transition-colors hover:bg-[--color-bg-muted]"
      >
        Reavaliar anamnese
      </button>
    </div>
  );
}
