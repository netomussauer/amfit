'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useExercicio } from '../hooks/useExercicio';
import { useDesativarExercicio } from '../hooks/useDesativarExercicio';
import { ExercicioForm } from './ExercicioForm';
import { MidiaPreview } from './MidiaPreview';

type Props = {
  exercicioId: string;
};

export function ExercicioDetalhe({ exercicioId }: Props) {
  const router = useRouter();
  const { data: exercicio, isLoading, isError, refetch } = useExercicio(exercicioId);
  const { mutate: desativar, isPending: isDeleting } = useDesativarExercicio();
  const [actionError, setActionError] = useState<string | null>(null);

  function handleDelete() {
    if (!exercicio) return;
    const confirmacao = window.confirm(
      `Tem certeza que deseja remover "${exercicio.nome}"? Esta ação não pode ser desfeita.`,
    );
    if (!confirmacao) return;

    setActionError(null);
    desativar(exercicioId, {
      onSuccess: () => {
        router.replace('/exercicios');
        router.refresh();
      },
      onError: (err) => {
        if (err.response?.status === 403) {
          setActionError('Exercícios globais não podem ser removidos.');
          return;
        }
        if (err.response?.status === 409) {
          setActionError(
            'Este exercício está em uso em fichas e não pode ser removido.',
          );
          return;
        }
        setActionError('Não foi possível remover o exercício. Tente novamente.');
      },
    });
  }

  if (isLoading) {
    return (
      <p className="text-sm text-[--color-text-muted]">Carregando exercício...</p>
    );
  }

  if (isError || !exercicio) {
    return (
      <div>
        <p role="alert" className="text-sm text-[--color-danger]">
          Não foi possível carregar este exercício.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 rounded-md border border-[--color-border] px-3 py-1.5 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const isReadOnly = exercicio.is_global;

  return (
    <div className="space-y-6">
      <nav aria-label="breadcrumb" className="text-sm text-[--color-text-muted]">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/exercicios" className="hover:text-[--color-primary]">
              Exercícios
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[--color-text]">{exercicio.nome}</li>
        </ol>
      </nav>

      <header className="flex flex-col gap-3 border-b border-[--color-border] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[--color-text]">{exercicio.nome}</h1>
          <p className="text-sm text-[--color-text-muted]">
            {exercicio.grupo_muscular.nome}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {exercicio.is_global && (
            <span className="inline-flex rounded-full bg-[--color-bg-muted] px-2 py-0.5 text-xs font-medium text-[--color-text-muted]">
              Global
            </span>
          )}
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              aria-busy={isDeleting}
              className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-[--color-danger] transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeleting ? 'Removendo...' : 'Remover exercício'}
            </button>
          )}
        </div>
      </header>

      {actionError && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-[--color-danger]"
        >
          {actionError}
        </p>
      )}

      <section aria-labelledby="midia-heading" className="space-y-3">
        <h2
          id="midia-heading"
          className="text-lg font-semibold text-[--color-text]"
        >
          Mídia
        </h2>
        <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-lg border border-[--color-border] bg-[--color-bg-muted]">
          <MidiaPreview
            url={exercicio.midia_url}
            tipo={exercicio.tipo_midia}
            alt={exercicio.nome}
            controls
            className="h-full w-full object-cover"
          />
        </div>
      </section>

      <section aria-labelledby="info-heading" className="space-y-4">
        <h2
          id="info-heading"
          className="text-lg font-semibold text-[--color-text]"
        >
          Informações
        </h2>
        <ExercicioForm
          mode="edit"
          exercicioId={exercicio.id}
          readOnly={isReadOnly}
          defaultValues={{
            nome: exercicio.nome,
            grupo_muscular_id: exercicio.grupo_muscular.id,
            descricao: exercicio.descricao ?? '',
          }}
        />
      </section>
    </div>
  );
}
