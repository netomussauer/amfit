'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { ItemTreinoResponse, RegistroSerieResponse } from '@amfit/shared';

type Props = {
  item: ItemTreinoResponse;
  numeroSerie: number;
  registro: RegistroSerieResponse | undefined;
  onConcluir: (input: {
    numero_serie: number;
    item_treino_id: string;
    concluida: boolean;
    carga_realizada: number | null;
    repeticoes_realizadas: number | null;
  }) => void;
};

function parseNumero(raw: string): number | null {
  if (!raw.trim()) return null;
  const cleaned = raw.replace(',', '.');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function parseInteiro(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}

function formatCarga(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
}

export function SerieRow({ item, numeroSerie, registro, onConcluir }: Props) {
  const concluida = registro?.concluida ?? false;

  const [carga, setCarga] = useState<string>(() =>
    formatCarga(registro?.carga_realizada ?? item.carga_sugerida ?? null),
  );
  const [reps, setReps] = useState<string>(() =>
    registro?.repeticoes_realizadas != null
      ? String(registro.repeticoes_realizadas)
      : '',
  );

  // Sincroniza inputs quando o registro vindo do servidor muda (ex: refetch).
  useEffect(() => {
    if (registro) {
      setCarga(formatCarga(registro.carga_realizada ?? item.carga_sugerida ?? null));
      setReps(
        registro.repeticoes_realizadas != null
          ? String(registro.repeticoes_realizadas)
          : '',
      );
    }
  }, [registro, item.carga_sugerida]);

  function handleToggle() {
    const novaCondicao = !concluida;
    onConcluir({
      numero_serie: numeroSerie,
      item_treino_id: item.id,
      concluida: novaCondicao,
      carga_realizada: parseNumero(carga),
      repeticoes_realizadas: parseInteiro(reps),
    });
  }

  const inputBorderClass = concluida ? 'border-green-200' : 'border-[--color-border]';

  return (
    <div
      className={[
        'flex items-center gap-3 rounded-md border px-3 py-2.5',
        concluida ? 'border-green-200 bg-green-50' : 'border-[--color-border] bg-[--color-bg]',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
          concluida ? 'bg-green-500 text-white' : 'bg-[--color-bg-muted] text-[--color-text-muted]',
        ].join(' ')}
      >
        {numeroSerie}
      </span>

      <div className="flex flex-1 gap-2">
        <div className="flex-1">
          <label
            htmlFor={`carga-${item.id}-${numeroSerie}`}
            className="mb-1 block text-[10px] font-medium uppercase text-[--color-text-muted]"
          >
            Carga (kg)
          </label>
          <input
            id={`carga-${item.id}-${numeroSerie}`}
            type="text"
            inputMode="decimal"
            value={carga}
            onChange={(e) => setCarga(e.target.value)}
            placeholder="--"
            disabled={concluida}
            className={[
              'w-full rounded-md border bg-[--color-bg] px-2 py-1.5 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary] disabled:cursor-not-allowed disabled:opacity-70',
              inputBorderClass,
            ].join(' ')}
          />
        </div>

        <div className="flex-1">
          <label
            htmlFor={`reps-${item.id}-${numeroSerie}`}
            className="mb-1 block text-[10px] font-medium uppercase text-[--color-text-muted]"
          >
            Reps
          </label>
          <input
            id={`reps-${item.id}-${numeroSerie}`}
            type="text"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder={item.repeticoes}
            disabled={concluida}
            className={[
              'w-full rounded-md border bg-[--color-bg] px-2 py-1.5 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary] disabled:cursor-not-allowed disabled:opacity-70',
              inputBorderClass,
            ].join(' ')}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={concluida}
        aria-label={`Marcar série ${numeroSerie} como ${concluida ? 'não concluída' : 'concluída'}`}
        className={[
          'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary]',
          concluida
            ? 'bg-green-500 text-white hover:bg-green-600'
            : 'border border-[--color-border] bg-[--color-bg] text-[--color-text-muted] hover:bg-[--color-bg-muted]',
        ].join(' ')}
      >
        <Check aria-hidden="true" className="h-5 w-5" />
      </button>
    </div>
  );
}
