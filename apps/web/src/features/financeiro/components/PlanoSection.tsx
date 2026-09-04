'use client';

import { useState } from 'react';
import type { PlanoResponse } from '@amfit/shared';
import { usePlanoAluno } from '../hooks/usePlanoAluno';
import { formatBRL } from '../lib/format';
import { PlanoForm } from './PlanoForm';

const STATUS_LABEL: Record<string, string> = {
  ATIVO: 'Ativo',
  SUSPENSO: 'Suspenso',
  ENCERRADO: 'Encerrado',
};

type Props = {
  alunoId: string;
};

export function PlanoSection({ alunoId }: Props) {
  const planoQuery = usePlanoAluno(alunoId);
  const [formOpen, setFormOpen] = useState(false);
  // Mesmo raciocínio do AnamneseSection: a resposta do POST/PATCH já traz o
  // plano atualizado, guardamos localmente pra mostrar sem depender de um
  // novo GET.
  const [ultimoResultado, setUltimoResultado] = useState<PlanoResponse | null>(null);

  const plano = ultimoResultado ?? planoQuery.data ?? null;
  const erroInesperado = planoQuery.isError && planoQuery.error.response?.status !== 404;

  function handleSaved(resultado: PlanoResponse) {
    setUltimoResultado(resultado);
    setFormOpen(false);
  }

  return (
    <section aria-labelledby="plano-heading" className="space-y-4">
      <h2 id="plano-heading" className="text-lg font-semibold text-[--color-text]">
        Plano
      </h2>

      {planoQuery.isLoading ? (
        <PlanoSkeleton />
      ) : erroInesperado ? (
        <div className="rounded-lg border border-[--color-border] bg-[--color-bg] px-4 py-8 text-center shadow-sm">
          <p role="alert" className="text-sm text-[--color-danger]">
            Não foi possível carregar o plano.
          </p>
          <button
            type="button"
            onClick={() => planoQuery.refetch()}
            className="mt-3 rounded-md border border-[--color-border] px-3 py-1.5 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
          >
            Tentar novamente
          </button>
        </div>
      ) : formOpen ? (
        <div className="rounded-lg border border-[--color-border] bg-[--color-bg] p-6 shadow-sm">
          <PlanoForm
            alunoId={alunoId}
            planoExistente={plano ?? undefined}
            onSuccess={handleSaved}
            onCancel={() => setFormOpen(false)}
          />
        </div>
      ) : plano ? (
        <PlanoResumo plano={plano} onEditar={() => setFormOpen(true)} />
      ) : (
        <EmptyPlanoState onConfigurar={() => setFormOpen(true)} />
      )}
    </section>
  );
}

function PlanoResumo({ plano, onEditar }: { plano: PlanoResponse; onEditar: () => void }) {
  return (
    <div className="rounded-lg border border-[--color-border] bg-[--color-bg] p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold text-[--color-text]">
            {formatBRL(plano.valor_mensal)}
            <span className="text-sm font-normal text-[--color-text-muted]">/mês</span>
          </p>
          <p className="mt-1 text-sm text-[--color-text-muted]">
            Vencimento todo dia {plano.dia_vencimento}
          </p>
        </div>
        <span
          className={[
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            plano.status === 'ATIVO'
              ? 'bg-green-50 text-[--color-success]'
              : 'bg-[--color-bg-muted] text-[--color-text-muted]',
          ].join(' ')}
        >
          {STATUS_LABEL[plano.status] ?? plano.status}
        </span>
      </div>
      {plano.observacao && (
        <p className="mt-3 text-sm text-[--color-text-muted]">{plano.observacao}</p>
      )}
      <button
        type="button"
        onClick={onEditar}
        className="mt-4 rounded-md border border-[--color-border] px-3 py-1.5 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted]"
      >
        Editar plano
      </button>
    </div>
  );
}

function EmptyPlanoState({ onConfigurar }: { onConfigurar: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[--color-border] bg-[--color-bg] px-4 py-10 text-center shadow-sm">
      <p className="text-sm text-[--color-text-muted]">
        Este aluno ainda não tem um plano configurado.
      </p>
      <button
        type="button"
        onClick={onConfigurar}
        className="rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[--color-primary-hover]"
      >
        Configurar plano
      </button>
    </div>
  );
}

function PlanoSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="space-y-2 rounded-lg border border-[--color-border] bg-[--color-bg] p-6 shadow-sm"
    >
      <div className="h-6 w-1/3 animate-pulse rounded bg-[--color-bg-muted]" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-[--color-bg-muted]" />
    </div>
  );
}
