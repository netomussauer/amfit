'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Dumbbell, TrendingUp } from 'lucide-react';
import type { ItemTreinoResponse, RegistroSerieResponse } from '@amfit/shared';
import { MidiaPreview } from '@/features/exercicios/components/MidiaPreview';
import { useSugestaoProgressao } from '@/features/meu-progresso';
import { SerieRow } from './SerieRow';

type Props = {
  item: ItemTreinoResponse;
  registros: RegistroSerieResponse[];
  onRegistrarSerie: (input: {
    numero_serie: number;
    item_treino_id: string;
    concluida: boolean;
    carga_realizada: number | null;
    repeticoes_realizadas: number | null;
  }) => void;
};

function formatCarga(carga: number | null | undefined): string | null {
  if (carga === null || carga === undefined) return null;
  const formatted = Number.isInteger(carga)
    ? String(carga)
    : carga.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted.replace('.', ',')} kg`;
}

export function ExercicioBlock({ item, registros, onRegistrarSerie }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { exercicio } = item;
  const sugestao = useSugestaoProgressao(exercicio.id);
  const cargaProgressao = sugestao.data?.tem_sugestao ? sugestao.data.carga_sugerida : undefined;
  const carga = formatCarga(cargaProgressao ?? item.carga_sugerida);
  const concluidas = registros.filter((r) => r.concluida).length;
  const totalSeries = item.series;

  return (
    <div className="rounded-lg border border-[--color-border] bg-[--color-bg] shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary]"
      >
        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-md bg-[--color-bg-muted]">
          {exercicio.midia_url ? (
            <MidiaPreview
              url={exercicio.midia_url}
              tipo={exercicio.tipo_midia}
              alt={exercicio.nome}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Dumbbell aria-hidden="true" className="h-6 w-6 text-[--color-text-muted]" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[--color-text]">
            {exercicio.nome}
          </p>
          <p className="truncate text-xs text-[--color-text-muted]">
            {exercicio.grupo_muscular.nome}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-full bg-[--color-primary]/10 px-2 py-0.5 text-[11px] font-semibold text-[--color-primary]">
              {item.series}×{item.repeticoes}
            </span>
            {carga && (
              <span className="flex items-center gap-0.5 text-[11px] text-[--color-text-muted]">
                {sugestao.data?.direcao === 'AUMENTAR' && (
                  <TrendingUp aria-hidden="true" className="h-3 w-3 text-emerald-600" />
                )}
                Sugerida: {carga}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <span className="text-xs font-semibold text-[--color-text]">
            {concluidas}/{totalSeries}
          </span>
          {expanded ? (
            <ChevronUp aria-hidden="true" className="h-4 w-4 text-[--color-text-muted]" />
          ) : (
            <ChevronDown aria-hidden="true" className="h-4 w-4 text-[--color-text-muted]" />
          )}
        </div>
      </button>

      {expanded && item.observacao && (
        <p className="mx-4 mb-2 rounded-md bg-[--color-bg-subtle] px-3 py-2 text-xs text-[--color-text-muted]">
          {item.observacao}
        </p>
      )}

      <div className="space-y-2 px-4 pb-4">
        {Array.from({ length: totalSeries }, (_, i) => i + 1).map((numero) => {
          const registro = registros.find((r) => r.numero_serie === numero);
          return (
            <SerieRow
              key={numero}
              item={item}
              numeroSerie={numero}
              registro={registro}
              cargaSugeridaProgressao={cargaProgressao}
              onConcluir={onRegistrarSerie}
            />
          );
        })}
      </div>
    </div>
  );
}
