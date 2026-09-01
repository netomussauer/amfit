import { Dumbbell } from 'lucide-react';
import type { ItemTreinoResponse, TreinoResponse } from '@amfit/shared';
import { MidiaPreview } from '@/features/exercicios/components/MidiaPreview';

type Props = {
  treino: TreinoResponse;
};

function formatCarga(carga: number | null | undefined): string | null {
  if (carga === null || carga === undefined) return null;
  const formatted = Number.isInteger(carga)
    ? String(carga)
    : carga.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted.replace('.', ',')} kg`;
}

export function TreinoHojeCard({ treino }: Props) {
  return (
    <div
      className="rounded-lg border border-[--color-border] bg-[--color-bg] p-4 shadow-sm"
      aria-label={`Treino ${treino.letra}${treino.nome ? `, ${treino.nome}` : ''}, ${treino.itens.length} exercícios`}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[--color-primary] text-xl font-bold text-white"
        >
          {treino.letra}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-[--color-text]">
            Treino {treino.letra}
          </p>
          {treino.nome && (
            <p className="truncate text-xs text-[--color-text-muted]">{treino.nome}</p>
          )}
          <p className="mt-0.5 text-xs text-[--color-text-muted]">
            {treino.itens.length}{' '}
            {treino.itens.length === 1 ? 'exercício' : 'exercícios'}
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2" aria-label={`Exercícios do treino ${treino.letra}`}>
        {treino.itens.map((item) => (
          <ExercicioPreviewRow key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

function ExercicioPreviewRow({ item }: { item: ItemTreinoResponse }) {
  const { exercicio } = item;
  const carga = formatCarga(item.carga_sugerida);

  return (
    <li className="flex items-center gap-3 rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2.5">
      <div className="h-[52px] w-[52px] flex-shrink-0 overflow-hidden rounded-md bg-[--color-bg-muted]">
        {exercicio.midia_url ? (
          <MidiaPreview
            url={exercicio.midia_url}
            tipo={exercicio.tipo_midia}
            alt={exercicio.nome}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Dumbbell aria-hidden="true" className="h-5 w-5 text-[--color-text-muted]" />
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
          <span className="text-xs font-medium text-[--color-text]">
            {item.series}×{item.repeticoes}
          </span>
          {carga && (
            <>
              <span aria-hidden="true" className="text-xs text-[--color-text-muted]">
                •
              </span>
              <span className="text-xs text-[--color-text-muted]">{carga}</span>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
