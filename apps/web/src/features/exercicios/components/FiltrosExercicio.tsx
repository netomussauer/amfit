'use client';

import { useGruposMusculares } from '../hooks/useGruposMusculares';

type Props = {
  busca: string;
  grupoMuscularId: string;
  onBuscaChange: (value: string) => void;
  onGrupoMuscularChange: (value: string) => void;
};

export function FiltrosExercicio({
  busca,
  grupoMuscularId,
  onBuscaChange,
  onGrupoMuscularChange,
}: Props) {
  const { data: grupos, isLoading, isError } = useGruposMusculares();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[--color-border] bg-[--color-bg] p-4 shadow-sm sm:flex-row sm:items-end">
      <div className="flex-1">
        <label
          htmlFor="busca"
          className="mb-1 block text-xs font-medium text-[--color-text-muted]"
        >
          Buscar
        </label>
        <input
          id="busca"
          type="search"
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          placeholder="Nome do exercício..."
          className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
        />
      </div>

      <div className="sm:w-64">
        <label
          htmlFor="grupo_muscular"
          className="mb-1 block text-xs font-medium text-[--color-text-muted]"
        >
          Grupo muscular
        </label>
        <select
          id="grupo_muscular"
          value={grupoMuscularId}
          onChange={(e) => onGrupoMuscularChange(e.target.value)}
          disabled={isLoading || isError}
          className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Todos</option>
          {grupos?.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nome}
            </option>
          ))}
        </select>
        {isError && (
          <p role="alert" className="mt-1 text-xs text-[--color-danger]">
            Falha ao carregar grupos musculares.
          </p>
        )}
      </div>
    </div>
  );
}
