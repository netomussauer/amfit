'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import type { ItemTreinoResponse, RegistroSerieResponse } from '@amfit/shared';

type Props = {
  item: ItemTreinoResponse;
  numeroSerie: number;
  registro: RegistroSerieResponse | undefined;
  /** Carga sugerida pelo cálculo de progressão (progressive overload), se houver. */
  cargaSugeridaProgressao?: number;
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

export function SerieRow({
  item,
  numeroSerie,
  registro,
  cargaSugeridaProgressao,
  onConcluir,
}: Props) {
  const concluida = registro?.concluida ?? false;
  // A sugestão de progressão chega por um useQuery separado (resolve
  // depois do primeiro render) — se o aluno já editou o campo de carga
  // manualmente antes dela chegar, não sobrescreve o que ele digitou.
  const usuarioEditouCargaRef = useRef(false);

  const [carga, setCarga] = useState<string>(() =>
    formatCarga(registro?.carga_realizada ?? cargaSugeridaProgressao ?? item.carga_sugerida ?? null),
  );
  const [reps, setReps] = useState<string>(() =>
    registro?.repeticoes_realizadas != null
      ? String(registro.repeticoes_realizadas)
      : '',
  );

  // Dois efeitos separados de propósito (achado de code-review): se um único
  // efeito reagisse tanto a `registro` quanto a `cargaSugeridaProgressao`,
  // uma revalidação em background da sugestão (staleTime curto, useQuery
  // independente) reexecutaria o branch "sincroniza com o registro" e
  // resetaria pro último valor SALVO — descartando uma edição que o aluno
  // esteja fazendo numa série já persistida (ex: desmarcou pra corrigir o
  // valor antes de reenviar).
  useEffect(() => {
    if (registro) {
      setCarga(
        formatCarga(registro.carga_realizada ?? cargaSugeridaProgressao ?? item.carga_sugerida ?? null),
      );
      setReps(
        registro.repeticoes_realizadas != null
          ? String(registro.repeticoes_realizadas)
          : '',
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registro, item.carga_sugerida]);

  // Reage só a cargaSugeridaProgressao chegando/mudando — nunca a `registro`
  // mudando sozinho, que é tratado no efeito acima.
  useEffect(() => {
    if (!registro && !usuarioEditouCargaRef.current && cargaSugeridaProgressao != null) {
      setCarga(formatCarga(cargaSugeridaProgressao));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargaSugeridaProgressao]);

  function handleCargaChange(value: string) {
    usuarioEditouCargaRef.current = true;
    setCarga(value);
  }

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
            onChange={(e) => handleCargaChange(e.target.value)}
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
