'use client';

import { useState } from 'react';
import type { AnamneseResponse, RegistrarAnamneseRequest } from '@amfit/shared';
import { useAnamnese } from '../hooks/useAnamnese';
import { AnamneseForm } from './AnamneseForm';
import { AnamneseResultado } from './AnamneseResultado';
import { TemplateSugestaoCard } from './TemplateSugestaoCard';

type Props = {
  alunoId: string;
};

export function AnamneseSection({ alunoId }: Props) {
  const anamneseQuery = useAnamnese(alunoId);
  const [formOpen, setFormOpen] = useState(false);
  // A resposta do POST traz a sugestão de template, que o GET não devolve
  // (só é calculada no momento do upsert) — guardamos localmente para
  // mostrar o card de sugestão logo após salvar, sem depender de um novo GET.
  const [ultimoResultado, setUltimoResultado] = useState<AnamneseResponse | null>(null);

  const anamnese = ultimoResultado ?? anamneseQuery.data ?? null;
  const erroInesperado = anamneseQuery.isError && anamneseQuery.error.response?.status !== 404;

  function handleSaved(resultado: AnamneseResponse) {
    setUltimoResultado(resultado);
    setFormOpen(false);
  }

  function handleReavaliar() {
    setUltimoResultado(null);
    setFormOpen(true);
  }

  return (
    <section aria-labelledby="anamnese-heading" className="space-y-4">
      <h2 id="anamnese-heading" className="text-lg font-semibold text-[--color-text]">
        Anamnese
      </h2>

      {anamneseQuery.isLoading ? (
        <AnamneseSkeleton />
      ) : erroInesperado ? (
        <div className="rounded-lg border border-[--color-border] bg-[--color-bg] px-4 py-8 text-center shadow-sm">
          <p role="alert" className="text-sm text-[--color-danger]">
            Não foi possível carregar a anamnese.
          </p>
          <button
            type="button"
            onClick={() => anamneseQuery.refetch()}
            className="mt-3 rounded-md border border-[--color-border] px-3 py-1.5 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
          >
            Tentar novamente
          </button>
        </div>
      ) : formOpen ? (
        <div className="rounded-lg border border-[--color-border] bg-[--color-bg] p-6 shadow-sm">
          <AnamneseForm
            alunoId={alunoId}
            defaultValues={anamnese ? toDefaultValues(anamnese) : undefined}
            onSuccess={handleSaved}
            onCancel={() => setFormOpen(false)}
          />
        </div>
      ) : anamnese ? (
        <div className="space-y-4">
          <AnamneseResultado anamnese={anamnese} onReavaliar={handleReavaliar} />
          {anamnese.template_ficha_id && anamnese.template_ficha_nome && (
            <TemplateSugestaoCard
              alunoId={alunoId}
              templateId={anamnese.template_ficha_id}
              templateNome={anamnese.template_ficha_nome}
            />
          )}
        </div>
      ) : (
        <EmptyAnamneseState onPreencher={() => setFormOpen(true)} />
      )}
    </section>
  );
}

function toDefaultValues(anamnese: AnamneseResponse): Partial<RegistrarAnamneseRequest> {
  return {
    objetivo: anamnese.objetivo,
    lesoes: anamnese.lesoes ?? '',
    doencas_preexistentes: anamnese.doencas_preexistentes ?? '',
    medicamentos: anamnese.medicamentos ?? '',
    pratica_outro_esporte: anamnese.pratica_outro_esporte,
    outro_esporte: anamnese.outro_esporte ?? '',
    frequencia_semanas_anterior: anamnese.frequencia_semanas_anterior ?? undefined,
    observacoes_gerais: anamnese.observacoes_gerais ?? '',
  };
}

function EmptyAnamneseState({ onPreencher }: { onPreencher: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[--color-border] bg-[--color-bg] px-4 py-10 text-center shadow-sm">
      <p className="text-sm text-[--color-text-muted]">
        Este aluno ainda não tem uma anamnese registrada.
      </p>
      <button
        type="button"
        onClick={onPreencher}
        className="rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[--color-primary-hover]"
      >
        Preencher anamnese
      </button>
    </div>
  );
}

function AnamneseSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="space-y-2 rounded-lg border border-[--color-border] bg-[--color-bg] p-6 shadow-sm"
    >
      <div className="h-4 w-1/3 animate-pulse rounded bg-[--color-bg-muted]" />
      <div className="h-4 w-2/3 animate-pulse rounded bg-[--color-bg-muted]" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-[--color-bg-muted]" />
    </div>
  );
}
