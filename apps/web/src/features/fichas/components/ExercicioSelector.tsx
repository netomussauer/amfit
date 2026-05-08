'use client';

import { useState } from 'react';
import type { ExercicioResponse } from '@amfit/shared';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useExercicios } from '@/features/exercicios/hooks/useExercicios';
import { useGruposMusculares } from '@/features/exercicios/hooks/useGruposMusculares';
import { MidiaPreview } from '@/features/exercicios/components/MidiaPreview';
import { Modal } from './Modal';

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (exercicio: ExercicioResponse) => void;
};

export function ExercicioSelector({ open, onClose, onSelect }: Props) {
  const [busca, setBusca] = useState('');
  const [grupoMuscularId, setGrupoMuscularId] = useState('');

  const buscaDebounced = useDebounce(busca, 250);

  const { data: gruposData } = useGruposMusculares();
  const grupos = gruposData ?? [];

  const { data, isLoading, isError } = useExercicios({
    busca: buscaDebounced || undefined,
    grupo_muscular_id: grupoMuscularId || undefined,
  });

  const exercicios = data?.data ?? [];

  function handleSelect(exercicio: ExercicioResponse) {
    onSelect(exercicio);
    setBusca('');
    setGrupoMuscularId('');
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Selecionar exercício"
      description="Busque ou filtre por grupo muscular para escolher o exercício."
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="selector-busca"
              className="mb-1 block text-xs font-medium text-[--color-text-muted]"
            >
              Buscar
            </label>
            <input
              id="selector-busca"
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome do exercício..."
              autoFocus
              className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
            />
          </div>
          <div className="sm:w-56">
            <label
              htmlFor="selector-grupo"
              className="mb-1 block text-xs font-medium text-[--color-text-muted]"
            >
              Grupo muscular
            </label>
            <select
              id="selector-grupo"
              value={grupoMuscularId}
              onChange={(e) => setGrupoMuscularId(e.target.value)}
              className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
            >
              <option value="">Todos</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <p className="px-2 py-8 text-center text-sm text-[--color-text-muted]">
            Carregando exercícios...
          </p>
        ) : isError ? (
          <p
            role="alert"
            className="px-2 py-8 text-center text-sm text-[--color-danger]"
          >
            Não foi possível carregar a lista de exercícios.
          </p>
        ) : exercicios.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-[--color-text-muted]">
            Nenhum exercício encontrado.
          </p>
        ) : (
          <ul
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Exercícios disponíveis"
          >
            {exercicios.map((exercicio) => (
              <li key={exercicio.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(exercicio)}
                  className="group flex w-full flex-col overflow-hidden rounded-lg border border-[--color-border] bg-[--color-bg] text-left shadow-sm transition-colors hover:border-[--color-primary] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary]"
                  aria-label={`Selecionar ${exercicio.nome}`}
                >
                  <div className="aspect-video w-full overflow-hidden bg-[--color-bg-muted]">
                    <MidiaPreview
                      url={exercicio.midia_url}
                      tipo={exercicio.tipo_midia}
                      alt={exercicio.nome}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <span className="text-sm font-semibold text-[--color-text] group-hover:text-[--color-primary]">
                      {exercicio.nome}
                    </span>
                    <span className="inline-flex w-fit rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-[--color-primary]">
                      {exercicio.grupo_muscular.nome}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
