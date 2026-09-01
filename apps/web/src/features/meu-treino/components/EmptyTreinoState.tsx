import { CalendarOff } from 'lucide-react';

type Props = {
  title?: string;
  description?: string;
};

export function EmptyTreinoState({
  title = 'Nenhum treino agendado',
  description = 'Quando seu personal liberar uma ficha, ela aparecerá aqui.',
}: Props) {
  return (
    <div
      role="status"
      className="flex flex-col items-center rounded-lg border border-dashed border-[--color-border] bg-[--color-bg-subtle] px-6 py-10 text-center"
    >
      <CalendarOff aria-hidden="true" className="h-11 w-11 text-[--color-text-muted]" />
      <p className="mt-4 text-base font-medium text-[--color-text]">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-[--color-text-muted]">{description}</p>
    </div>
  );
}
