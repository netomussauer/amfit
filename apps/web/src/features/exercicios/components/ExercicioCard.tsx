import Link from 'next/link';
import type { ExercicioResponse } from '@amfit/shared';
import { MidiaPreview } from './MidiaPreview';

type Props = {
  exercicio: ExercicioResponse;
};

export function ExercicioCard({ exercicio }: Props) {
  return (
    <Link
      href={`/exercicios/${exercicio.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-[--color-border] bg-[--color-bg] shadow-sm transition-colors hover:border-[--color-primary] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary]"
      aria-label={`Ver detalhes de ${exercicio.nome}`}
    >
      <div className="aspect-video w-full overflow-hidden bg-[--color-bg-muted]">
        <MidiaPreview
          url={exercicio.midia_url}
          tipo={exercicio.tipo_midia}
          alt={exercicio.nome}
          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-[--color-text] group-hover:text-[--color-primary]">
            {exercicio.nome}
          </h3>
          {exercicio.is_global && (
            <span className="inline-flex flex-shrink-0 rounded-full bg-[--color-bg-muted] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[--color-text-muted]">
              Global
            </span>
          )}
        </div>

        <span className="inline-flex w-fit rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-[--color-primary]">
          {exercicio.grupo_muscular.nome}
        </span>

        {exercicio.descricao && (
          <p className="line-clamp-2 text-xs text-[--color-text-muted]">
            {exercicio.descricao}
          </p>
        )}
      </div>
    </Link>
  );
}
